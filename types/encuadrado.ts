/**
 * Schemas de la API pública de Encuadrado v1.
 * Base URL: https://encuadrado.com/api/public/v1
 */

// ─── GET /services/{service_uuid}/available-time-slots ───

export interface AvailableTimeSlotsQuery {
  /** ISO-8601 */
  start?: string;
  /** ISO-8601 */
  end?: string;
}

export interface TimeSlot {
  /** ISO-8601, en la API real viene como "2026-09-22T17:00:00+00:00" */
  start: string;
  end: string;
  /** No documentados; observados en la API real (2026-09-17) */
  available_vacancy?: number;
  title?: string;
}

export type AvailableTimeSlotsResponse = TimeSlot[];

// ─── POST /services/{service_uuid}/bookings ───

export interface CreateBookingData {
  full_name: string;
  /** ISO-8601 */
  booking_date_time: string;
  email?: string;
  phone?: string;
  /** ej. "+56" */
  phone_country_code?: string;
  /** Solo se acepta si coincide con el dominio validado en Encuadrado */
  redirect_url?: string;
  /** JSON serializado libre */
  attribution?: string;
  comments?: string;
  terms_and_conditions?: boolean;
}

export interface CreateBookingRequest {
  data: CreateBookingData;
}

interface BookingResponseBase {
  service_name: string;
  booking_start_time: string;
  booking_end_time: string;
}

/** 201 — reserva confirmada sin prepago */
export interface ConfirmedBookingResponse extends BookingResponseBase {
  booking_token: string;
  temporal_booking_token: null;
  extras: {
    intake_form_url?: string;
  };
}

/** 201 — reserva temporal que requiere prepago */
export interface TemporalBookingResponse extends BookingResponseBase {
  booking_token: null;
  temporal_booking_token: string;
  extras: {
    payment_url: string;
    /** ISO-8601 con offset */
    slot_reservation_expires_at: string;
    redirect_url_accepted: boolean;
  };
}

export type CreateBookingResponse =
  | ConfirmedBookingResponse
  | TemporalBookingResponse;

export function isTemporalBooking(
  res: CreateBookingResponse,
): res is TemporalBookingResponse {
  return res.temporal_booking_token !== null;
}

// ─── Errores ───

export type EncuadradoErrorCode =
  | "INVALID_DATE"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_SERVER_ERROR"
  | "CALENDAR_UNAVAILABLE"
  | "BOOKING_FAILED"
  | "INVALID_PAYLOAD";

/**
 * Body de error. Verificado contra la API real (401): `{"error":"UNAUTHORIZED"}`.
 * Para BOOKING_FAILED la doc indica además `detail` y `field` legibles.
 * Se aceptan variantes defensivamente (ver normalizeErrorBody en lib/encuadrado/errors.ts).
 */
export interface EncuadradoErrorBody {
  error?: EncuadradoErrorCode | string | { code?: string; detail?: string; field?: string };
  code?: EncuadradoErrorCode | string;
  detail?: string;
  field?: string;
  [key: string]: unknown;
}
