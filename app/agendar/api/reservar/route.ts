import { after, NextResponse } from "next/server";

import { createBooking } from "@/lib/encuadrado/client";
import { isDryRunScenario } from "@/lib/encuadrado/dry-run";
import {
  EncuadradoError,
  toHttpStatus,
  toUserFacingError,
} from "@/lib/encuadrado/errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendToN8n } from "@/lib/n8n";
import { SUCCESS_PATH } from "@/lib/routes";
import { clean, cleanUtms } from "@/lib/tracking/params";
import { isTemporalBooking } from "@/types/encuadrado";
import type {
  ApiErrorResponse,
  BookingInitiatedPayload,
  ReservarRequest,
  ReservarSuccess,
  Utms,
} from "@/types/tracking";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function errorResponse(
  status: number,
  message: string,
  field?: string,
  retryable = false,
) {
  return NextResponse.json<ApiErrorResponse>(
    { error: { message, field, retryable } },
    { status },
  );
}

/**
 * Normaliza teléfonos chilenos a 9 dígitos (sin +56).
 * Acepta "+56 9 1234 5678", "56912345678", "912345678", "9 1234 5678".
 */
function normalizeChileanPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("56")) digits = digits.slice(2);
  return /^\d{9}$/.test(digits) ? digits : null;
}

type Validated = Omit<ReservarRequest, "terms_accepted" | "utms"> & {
  utms: Utms;
};

function validate(
  body: unknown,
): { ok: true; data: Validated } | { ok: false; field: string; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, field: "form", message: "Solicitud inválida." };
  }
  const b = body as Record<string, unknown>;

  const fullName = clean(b.full_name);
  if (!fullName || fullName.length < 3 || fullName.length > 120) {
    return {
      ok: false,
      field: "full_name",
      message: "Ingresa tu nombre completo.",
    };
  }

  const email = clean(b.email)?.toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, field: "email", message: "Ingresa un email válido." };
  }

  const phone = typeof b.phone === "string" ? normalizeChileanPhone(b.phone) : null;
  if (!phone) {
    return {
      ok: false,
      field: "phone",
      message: "Ingresa un teléfono chileno válido de 9 dígitos (ej. 9 1234 5678).",
    };
  }

  const bookingDateTime = clean(b.booking_date_time);
  const bookingMs = bookingDateTime ? Date.parse(bookingDateTime) : NaN;
  if (!bookingDateTime || !Number.isFinite(bookingMs) || bookingMs <= Date.now()) {
    return {
      ok: false,
      field: "booking_date_time",
      message: "El horario seleccionado ya no está disponible. Por favor elige otro.",
    };
  }

  if (b.terms_accepted !== true) {
    return {
      ok: false,
      field: "terms",
      message: "Debes aceptar los términos y condiciones para continuar.",
    };
  }

  return {
    ok: true,
    data: {
      full_name: fullName,
      email,
      phone,
      booking_date_time: bookingDateTime,
      contactId: clean(b.contactId),
      utms: cleanUtms(b.utms),
      fbclid: clean(b.fbclid),
    },
  };
}

function buildReturnUrl(
  data: Validated,
  eventId: string,
  value: number,
): string {
  const url = new URL(SUCCESS_PATH, env.siteUrl);
  const set = (k: string, v: string | undefined) => {
    if (v) url.searchParams.set(k, v);
  };
  set("ref", data.contactId);
  set("event_id", eventId);
  set("utm_source", data.utms.utm_source);
  set("utm_medium", data.utms.utm_medium);
  set("utm_campaign", data.utms.utm_campaign);
  set("utm_content", data.utms.utm_content);
  set("utm_term", data.utms.utm_term);
  set("fbclid", data.fbclid);
  url.searchParams.set("value", String(value));
  // Horario elegido: la página de gracias lo muestra y arma el evento de calendario.
  // Normalizado a UTC con "Z": un "+00:00" podría llegar como espacio si el
  // redirect de Encuadrado re-codifica la URL.
  url.searchParams.set("slot", new Date(data.booking_date_time).toISOString());
  return url.toString();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Solicitud inválida.");
  }

  const result = validate(body);
  if (!result.ok) {
    return errorResponse(400, result.message, result.field);
  }
  const data = result.data;

  // (a) event_id propio, generado ANTES de llamar a Encuadrado.
  const eventId = "booking_" + crypto.randomUUID();
  const value = env.servicePriceClp;
  if (value === 0) {
    logger.warn("config.service_price_missing", { event_id: eventId }, "medium");
  }

  // Solo en dry-run: permitir elegir escenario por header para probar sin reiniciar.
  const scenarioHeader = request.headers.get("x-dry-run-scenario") ?? undefined;
  const dryRunScenario =
    env.dryRun && scenarioHeader && isDryRunScenario(scenarioHeader)
      ? scenarioHeader
      : undefined;

  logger.info("reservar.start", {
    event_id: eventId,
    contactId: data.contactId ?? null,
    booking_date_time: data.booking_date_time,
    has_utms: Object.keys(data.utms).length > 0,
    dry_run: env.dryRun,
    // valor crudo del entorno, para diagnosticar configuraciones erradas
    dry_run_raw: process.env.ENCUADRADO_DRY_RUN ?? "(sin definir)",
    service_price_raw: process.env.SERVICE_PRICE_CLP ?? "(sin definir)",
  });
  if (!data.contactId) {
    logger.warn("reservar.missing_contact_id", { event_id: eventId }, "medium");
  }

  try {
    // (b) redirect_url con todo lo que necesitamos recuperar al volver.
    const redirectUrl = buildReturnUrl(data, eventId, value);

    // (c) crear reserva en Encuadrado.
    const booking = await createBooking(
      {
        data: {
          full_name: data.full_name,
          booking_date_time: data.booking_date_time,
          email: data.email,
          phone: data.phone,
          phone_country_code: "+56",
          redirect_url: redirectUrl,
          attribution: JSON.stringify({
            ...data.utms,
            ...(data.fbclid ? { fbclid: data.fbclid } : {}),
            ...(data.contactId ? { ghl_contact_id: data.contactId } : {}),
            event_id: eventId,
          }),
          terms_and_conditions: true,
        },
      },
      { dryRunScenario },
    );

    const temporal = isTemporalBooking(booking) ? booking : null;

    if (temporal && temporal.extras.redirect_url_accepted !== true) {
      // El usuario NO volverá a nuestra página tras pagar: perdemos el tracking
      // client-side de esa conversión. No bloqueamos; booking_initiated queda en n8n.
      logger.error(
        "reservar.redirect_url_rejected",
        {
          event_id: eventId,
          temporal_booking_token: temporal.temporal_booking_token,
          site_url: env.siteUrl,
          hint: "Verifica que el dominio de SITE_URL coincida exactamente con el validado en Encuadrado",
        },
        "high",
      );
    }

    // Evento server-side a n8n en TODOS los casos, después de responder al usuario.
    const initiated: BookingInitiatedPayload = {
      event: "booking_initiated",
      occurred_at: new Date().toISOString(),
      event_id: eventId,
      contactId: data.contactId ?? null,
      utms: data.utms,
      fbclid: data.fbclid ?? null,
      booking_date_time: data.booking_date_time,
      temporal_booking_token: temporal?.temporal_booking_token ?? null,
      booking_token: booking.booking_token,
      slot_reservation_expires_at:
        temporal?.extras.slot_reservation_expires_at ?? null,
      redirect_url_accepted: temporal ? temporal.extras.redirect_url_accepted : null,
      value,
      currency: "CLP",
      dry_run: env.dryRun,
    };
    after(() => sendToN8n(initiated));

    // (d) respuesta al frontend.
    if (temporal) {
      logger.info("reservar.temporal_created", {
        event_id: eventId,
        redirect_url_accepted: temporal.extras.redirect_url_accepted,
        expires_at: temporal.extras.slot_reservation_expires_at,
      });
      return NextResponse.json<ReservarSuccess>(
        {
          kind: "payment_required",
          payment_url: temporal.extras.payment_url,
          event_id: eventId,
          expires_at: temporal.extras.slot_reservation_expires_at,
          value,
        },
        { status: 201 },
      );
    }

    // Caso no esperado para este servicio: confirmada sin prepago.
    logger.warn(
      "reservar.confirmed_without_prepayment",
      { event_id: eventId },
      "medium",
    );
    return NextResponse.json<ReservarSuccess>(
      { kind: "confirmed", success_url: redirectUrl, event_id: eventId, value },
      { status: 201 },
    );
  } catch (err) {
    if (!(err instanceof EncuadradoError)) {
      logger.error(
        "reservar.unexpected_error",
        {
          event_id: eventId,
          error: err instanceof Error ? err.message : String(err),
        },
        "critical",
      );
    }
    const userError = toUserFacingError(err, "booking");
    logger.warn("reservar.failed", {
      event_id: eventId,
      user_message: userError.message,
      field: userError.field,
    });
    return errorResponse(
      toHttpStatus(err),
      userError.message,
      userError.field,
      userError.retryable,
    );
  }
}
