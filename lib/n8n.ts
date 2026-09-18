import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  BookingInitiatedPayload,
  ConversionReturnPayload,
} from "@/types/tracking";

/** n8n procesa antes de responder (1–3 s según el automatizador). */
const N8N_TIMEOUT_MS = 10_000;
/**
 * Esperas entre reintentos. n8n es idempotente por event_id y garantiza que
 * un 502 es reintentable sin efectos duplicados; los 4xx (ej. 403 por secreto
 * incorrecto) no se reintentan.
 */
const RETRY_DELAYS_MS = [1_000, 3_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envía un evento a n8n. Nunca lanza: los fallos se loguean y se devuelve false,
 * porque el tracking no debe romper el flujo del usuario.
 * Reintenta ante 5xx, timeouts y errores de red.
 */
export async function sendToN8n(
  payload: BookingInitiatedPayload | ConversionReturnPayload,
): Promise<boolean> {
  const url = env.n8nWebhookUrl;
  if (!url) {
    logger.warn(
      "n8n.webhook_url_missing",
      { event: payload.event, event_id: payload.event_id },
      "high",
    );
    return false;
  }

  const secret = env.n8nWebhookSecret;
  if (!secret) {
    logger.warn(
      "n8n.webhook_secret_missing",
      { event: payload.event, event_id: payload.event_id },
      "medium",
    );
  }

  const log = { event: payload.event, event_id: payload.event_id };

  for (let attempt = 0; ; attempt++) {
    let status: number | null = null;
    let errorText: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Secreto compartido: n8n responde 403 si falta o no coincide.
          ...(secret ? { "X-CT-Webhook-Secret": secret } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
      });
      if (res.ok) {
        logger.info("n8n.webhook_ok", {
          ...log,
          attempt,
          // solo si se envió el header, nunca su valor
          signed: !!secret,
        });
        return true;
      }
      status = res.status;
    } catch (err) {
      errorText = err instanceof Error ? err.name + ": " + err.message : String(err);
    }

    const retryable = status === null || status >= 500;
    if (retryable && attempt < RETRY_DELAYS_MS.length) {
      logger.warn("n8n.webhook_retry", {
        ...log,
        attempt: attempt + 1,
        status,
        error: errorText,
      });
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    logger.error(
      status === null ? "n8n.webhook_error" : "n8n.webhook_failed",
      { ...log, attempt, status, error: errorText },
      status === 403 ? "critical" : "high",
    );
    return false;
  }
}
