import { NextResponse } from "next/server";

import { isPaymentConfirmed } from "@/lib/conversion";
import { logger } from "@/lib/logger";
import { sendToN8n } from "@/lib/n8n";
import { clean, parseReturnParams } from "@/lib/tracking/params";
import type { ConversionReturnPayload } from "@/types/tracking";

const MAX_BODY_BYTES = 16_000;

function clientIp(request: Request): string | null {
  // Detrás de Cloudflare → Vercel: CF-Connecting-IP es la IP real del usuario.
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  return xff ? (xff.split(",")[0]?.trim() ?? null) : null;
}

/**
 * Reenvía a n8n el retorno del usuario desde Encuadrado.
 * NO implementa CAPI ni GHL: eso vive en n8n.
 * `conversion_confirmed` se calcula acá (servidor), no se confía en el navegador.
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const rawInput =
    body.raw_query_params && typeof body.raw_query_params === "object"
      ? (body.raw_query_params as Record<string, unknown>)
      : {};
  const rawQueryParams: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(rawInput).slice(0, 50)) {
    const key = clean(k);
    if (!key) continue;
    if (Array.isArray(v)) {
      const vals = v.map(clean).filter((x): x is string => !!x);
      if (vals.length) rawQueryParams[key] = vals;
    } else {
      const val = clean(v);
      if (val !== undefined) rawQueryParams[key] = val;
    }
  }

  const parsed = parseReturnParams(rawQueryParams);

  const payload: ConversionReturnPayload = {
    event: "booking_return",
    occurred_at: new Date().toISOString(),
    event_id: parsed.eventId ?? null,
    contactId: parsed.contactId ?? null,
    utms: parsed.utms,
    fbclid: parsed.fbclid ?? null,
    value: parsed.value,
    currency: "CLP",
    conversion_confirmed: isPaymentConfirmed(rawQueryParams),
    raw_query_params: rawQueryParams,
    fbp: clean(body.fbp) ?? null,
    fbc: clean(body.fbc) ?? null,
    client_ip: clientIp(request),
    user_agent: clean(request.headers.get("user-agent")) ?? null,
    page_url: clean(body.page_url) ?? null,
  };

  if (!payload.event_id) {
    // Visita a /agendamiento-exitoso sin venir de una reserva (URL abierta a mano,
    // bots, extensiones). No se reenvía: sería un evento vacío para n8n.
    logger.warn("notificar.missing_event_id", {
      raw_query_params: rawQueryParams,
    });
    return NextResponse.json({ ok: false, skipped: true }, { status: 202 });
  }

  const ok = await sendToN8n(payload);
  return NextResponse.json({ ok }, { status: 202 });
}
