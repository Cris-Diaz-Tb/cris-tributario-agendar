import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  AvailableTimeSlotsQuery,
  AvailableTimeSlotsResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  EncuadradoErrorBody,
} from "@/types/encuadrado";
import { EncuadradoError, NETWORK_ERROR_STATUS } from "./errors";
import { dryRunCreateBooking, dryRunTimeSlots } from "./dry-run";

const BASE_URL = "https://encuadrado.com/api/public/v1";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
/** Si el rate limit se resetea más allá de esto, no vale la pena esperar dentro de la función. */
const MAX_RETRY_WAIT_MS = 5_000;

type Method = "GET" | "POST";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `X-RateLimit-Reset` no está especificado en la doc: puede venir como epoch (s o ms)
 * o como segundos restantes. Devuelve ms a esperar, o undefined si no se puede interpretar.
 */
function msUntilReset(headers: Headers): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return Number(retryAfter) * 1000;
  }
  const raw = headers.get("x-ratelimit-reset");
  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) return undefined;
  const n = Number(raw);
  const now = Date.now();
  if (n > 1e12) return Math.max(0, n - now); // epoch ms
  if (n > 1e9) return Math.max(0, n * 1000 - now); // epoch s
  return n * 1000; // segundos restantes
}

function logRateLimit(method: Method, path: string, headers: Headers) {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || limit <= 0) {
    return;
  }
  // POST: 10/min → avisar con ≤3. GET: 120/min → avisar con ≤20%.
  const threshold = method === "POST" ? 3 : Math.ceil(limit * 0.2);
  if (remaining <= threshold) {
    logger.warn(
      "encuadrado.rate_limit_low",
      { method, path, limit, remaining, reset: headers.get("x-ratelimit-reset") },
      "medium",
    );
  }
}

async function request<T>(
  method: Method,
  path: string,
  options: { query?: Record<string, string | undefined>; body?: unknown } = {},
): Promise<T> {
  const apiKey = env.encuadradoApiKey;
  if (!apiKey) {
    logger.error("encuadrado.missing_api_key", { path }, "critical");
    throw new EncuadradoError(401, { error: "UNAUTHORIZED" });
  }

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v) url.searchParams.set(k, v);
  }

  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      logger.error(
        "encuadrado.network_error",
        {
          method,
          path,
          attempt,
          error: err instanceof Error ? err.name + ": " + err.message : String(err),
        },
        "high",
      );
      throw new EncuadradoError(NETWORK_ERROR_STATUS, null);
    }

    logRateLimit(method, path, res.headers);

    if (res.ok) {
      logger.info("encuadrado.ok", {
        method,
        path,
        status: res.status,
        ms: Date.now() - startedAt,
      });
      return (await res.json()) as T;
    }

    let body: EncuadradoErrorBody | null = null;
    let rawText = "";
    try {
      rawText = await res.text();
      body = JSON.parse(rawText) as EncuadradoErrorBody;
    } catch {
      body = null;
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const backoff = 500 * 2 ** attempt; // 500ms, 1000ms
      const resetWait = msUntilReset(res.headers);
      const wait = Math.max(backoff, resetWait ?? 0);
      if (wait <= MAX_RETRY_WAIT_MS) {
        logger.warn("encuadrado.rate_limited_retry", {
          method,
          path,
          attempt: attempt + 1,
          waitMs: wait,
        });
        await sleep(wait);
        continue;
      }
      logger.warn(
        "encuadrado.rate_limited_reset_too_far",
        { method, path, resetWaitMs: resetWait },
        "high",
      );
    }

    const severity =
      res.status === 401 || res.status === 404
        ? "critical"
        : res.status >= 500 || res.status === 429
          ? "high"
          : "low";
    const error = new EncuadradoError(res.status, body);
    logger.error(
      "encuadrado.error",
      {
        method,
        path,
        status: res.status,
        code: error.code,
        detail: error.detail,
        field: error.field,
        // body crudo recortado, para descubrir formas de error no documentadas
        raw_body: rawText.slice(0, 500),
        attempt,
      },
      severity,
    );
    throw error;
  }
}

export async function getAvailableTimeSlots(
  query: AvailableTimeSlotsQuery,
): Promise<AvailableTimeSlotsResponse> {
  // Sin API key en dry-run local: horarios simulados para poder probar la UI.
  if (env.dryRun && !env.encuadradoApiKey) {
    logger.warn("encuadrado.dry_run_slots", { reason: "no api key" });
    return dryRunTimeSlots(query);
  }
  const uuid = encodeURIComponent(env.encuadradoServiceUuid);
  return request<AvailableTimeSlotsResponse>(
    "GET",
    `/services/${uuid}/available-time-slots`,
    { query: { start: query.start, end: query.end } },
  );
}

export async function createBooking(
  payload: CreateBookingRequest,
  opts: { dryRunScenario?: string } = {},
): Promise<CreateBookingResponse> {
  if (env.dryRun) {
    const scenario = opts.dryRunScenario ?? env.dryRunScenario;
    logger.warn("encuadrado.dry_run_booking", { scenario });
    return dryRunCreateBooking(payload, scenario);
  }
  const uuid = encodeURIComponent(env.encuadradoServiceUuid);
  return request<CreateBookingResponse>("POST", `/services/${uuid}/bookings`, {
    body: payload,
  });
}
