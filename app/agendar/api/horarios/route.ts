import { NextResponse } from "next/server";

import { getAvailableTimeSlots } from "@/lib/encuadrado/client";
import {
  EncuadradoError,
  toHttpStatus,
  toUserFacingError,
} from "@/lib/encuadrado/errors";
import { logger } from "@/lib/logger";
import type { TimeSlot } from "@/types/encuadrado";
import type { ApiErrorResponse, HorariosResponse } from "@/types/tracking";

const RANGE_DAYS = 14;
/** No ofrecer horarios que empiezan en menos de esto (el usuario no alcanza a pagar). */
const MIN_LEAD_MS = 15 * 60 * 1000;

export async function GET() {
  const now = new Date();
  const end = new Date(now.getTime() + RANGE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const slots = await getAvailableTimeSlots({
      start: now.toISOString(),
      end: end.toISOString(),
    });

    const cutoff = now.getTime() + MIN_LEAD_MS;
    const filtered = (Array.isArray(slots) ? slots : [])
      .filter(
        (s): s is TimeSlot =>
          typeof s?.start === "string" &&
          typeof s?.end === "string" &&
          new Date(s.start).getTime() > cutoff,
      )
      .sort((a, b) => a.start.localeCompare(b.start));

    return NextResponse.json<HorariosResponse>(
      { slots: filtered },
      {
        headers: {
          // Caché corta en el CDN de Vercel: protege el límite de 120 GET/min
          // sin mostrar disponibilidad muy desactualizada.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    // Los errores de Encuadrado ya se loguean en el cliente; aquí los inesperados
    // (ej. variable de entorno faltante).
    if (!(err instanceof EncuadradoError)) {
      logger.error(
        "horarios.unexpected_error",
        { error: err instanceof Error ? err.message : String(err) },
        "critical",
      );
    }
    const userError = toUserFacingError(err, "slots");
    return NextResponse.json<ApiErrorResponse>(
      { error: userError },
      { status: toHttpStatus(err), headers: { "Cache-Control": "no-store" } },
    );
  }
}
