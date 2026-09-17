import "server-only";

import type {
  AvailableTimeSlotsQuery,
  AvailableTimeSlotsResponse,
  ConfirmedBookingResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  TemporalBookingResponse,
} from "@/types/encuadrado";
import { EncuadradoError } from "./errors";

/**
 * Respuestas simuladas con la misma forma que la API real.
 * Solo se usan con ENCUADRADO_DRY_RUN=true. Nunca crean reservas reales.
 */

export const DRY_RUN_SCENARIOS = [
  "prepaid",
  "prepaid_redirect_rejected",
  "confirmed",
  "booking_failed",
  "rate_limited",
] as const;

export type DryRunScenario = (typeof DRY_RUN_SCENARIOS)[number];

export function isDryRunScenario(s: string): s is DryRunScenario {
  return (DRY_RUN_SCENARIOS as readonly string[]).includes(s);
}

const SERVICE_DURATION_MS = 60 * 60 * 1000;
const SLOT_HOLD_MS = 10 * 60 * 1000;

function fakeToken(prefix: string): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function dryRunTimeSlots(
  query: AvailableTimeSlotsQuery,
): AvailableTimeSlotsResponse {
  const start = query.start ? new Date(query.start) : new Date();
  const end = query.end
    ? new Date(query.end)
    : new Date(start.getTime() + 14 * 24 * 3600 * 1000);
  const slots: AvailableTimeSlotsResponse = [];
  const day = new Date(start);
  day.setUTCHours(0, 0, 0, 0);
  for (; day < end; day.setUTCDate(day.getUTCDate() + 1)) {
    const dow = day.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    // 10:00, 11:00, 15:00, 16:00 hora Chile ≈ 13/14/18/19 UTC (UTC-3)
    for (const h of [13, 14, 18, 19]) {
      if ((day.getUTCDate() + h) % 3 === 0) continue; // algunos huecos ocupados
      const s = new Date(day);
      s.setUTCHours(h);
      if (s <= start || s >= end) continue;
      slots.push({
        start: s.toISOString().replace(".000Z", "Z"),
        end: new Date(s.getTime() + SERVICE_DURATION_MS)
          .toISOString()
          .replace(".000Z", "Z"),
      });
    }
  }
  return slots;
}

export async function dryRunCreateBooking(
  payload: CreateBookingRequest,
  scenario: string,
): Promise<CreateBookingResponse> {
  await new Promise((r) => setTimeout(r, 600)); // latencia realista

  const startIso = payload.data.booking_date_time;
  const start = new Date(startIso);
  const endIso = new Date(start.getTime() + SERVICE_DURATION_MS).toISOString();
  const base = {
    service_name: "Asesoría Tributaria Inmobiliaria (DRY RUN)",
    booking_start_time: start.toISOString(),
    booking_end_time: endIso,
  };

  switch (scenario) {
    case "confirmed": {
      const res: ConfirmedBookingResponse = {
        ...base,
        booking_token: fakeToken("tok_dry_"),
        temporal_booking_token: null,
        extras: { intake_form_url: "https://encuadrado.com/dry-run/intake" },
      };
      return res;
    }

    case "booking_failed":
      throw new EncuadradoError(400, {
        error: "BOOKING_FAILED",
        detail: "Por favor ingresa un teléfono válido",
        field: "phone",
      });

    case "rate_limited":
      throw new EncuadradoError(429, { error: "RATE_LIMITED" });

    case "prepaid_redirect_rejected":
    case "prepaid":
    default: {
      const token = fakeToken("tb_tok_dry_");
      const redirectAccepted = scenario !== "prepaid_redirect_rejected";
      const res: TemporalBookingResponse = {
        ...base,
        booking_token: null,
        temporal_booking_token: token,
        extras: {
          // En dry-run con redirect aceptado, el "pago" salta directo a nuestra
          // página de retorno para poder probar el flujo completo sin Encuadrado.
          payment_url:
            redirectAccepted && payload.data.redirect_url
              ? payload.data.redirect_url + "&dry_run=1"
              : `https://encuadrado.com/pagar/prepago/${token}`,
          slot_reservation_expires_at: new Date(Date.now() + SLOT_HOLD_MS)
            .toISOString()
            .replace("Z", "+00:00"),
          redirect_url_accepted: redirectAccepted,
        },
      };
      return res;
    }
  }
}
