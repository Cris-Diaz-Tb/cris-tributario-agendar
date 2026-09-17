import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  BookingInitiatedPayload,
  ConversionReturnPayload,
} from "@/types/tracking";

const N8N_TIMEOUT_MS = 8_000;

/**
 * Envía un evento a n8n. Nunca lanza: los fallos se loguean y se devuelve false,
 * porque el tracking no debe romper el flujo del usuario.
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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Secreto compartido: n8n rechaza la request si no coincide.
        ...(secret ? { "X-CT-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.error(
        "n8n.webhook_failed",
        { event: payload.event, event_id: payload.event_id, status: res.status },
        "high",
      );
      return false;
    }
    logger.info("n8n.webhook_ok", {
      event: payload.event,
      event_id: payload.event_id,
      // solo si se envió el header, nunca su valor
      signed: !!secret,
    });
    return true;
  } catch (err) {
    logger.error(
      "n8n.webhook_error",
      {
        event: payload.event,
        event_id: payload.event_id,
        error: err instanceof Error ? err.name + ": " + err.message : String(err),
      },
      "high",
    );
    return false;
  }
}
