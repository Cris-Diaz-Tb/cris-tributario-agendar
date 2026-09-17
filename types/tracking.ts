import type { TimeSlot } from "@/types/encuadrado";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export type Utms = Partial<Record<UtmKey, string>>;

/** Contexto de atribución que llega desde el redirect de GHL a /agendar */
export interface AttributionContext {
  contactId?: string;
  utms: Utms;
  fbclid?: string;
}

// ─── Contrato interno: GET /agendar/api/horarios ───

export interface HorariosResponse {
  slots: TimeSlot[];
}

// ─── Contrato interno: POST /agendar/api/reservar ───

export interface ReservarRequest extends AttributionContext {
  full_name: string;
  email: string;
  phone: string;
  booking_date_time: string;
  terms_accepted: boolean;
}

export type ReservarSuccess =
  | {
      kind: "payment_required";
      payment_url: string;
      event_id: string;
      expires_at: string;
      /** CLP, para el Pixel InitiateCheckout */
      value: number;
    }
  | {
      /** Encuadrado confirmó sin prepago: vamos directo a la página de éxito */
      kind: "confirmed";
      success_url: string;
      event_id: string;
      value: number;
    };

export interface ApiErrorResponse {
  error: {
    /** Mensaje en español, listo para mostrar */
    message: string;
    /** Campo del formulario a resaltar, si Encuadrado lo indicó */
    field?: string;
    retryable: boolean;
  };
}

// ─── Payloads a n8n ───

export interface BookingInitiatedPayload {
  event: "booking_initiated";
  occurred_at: string;
  event_id: string;
  contactId: string | null;
  utms: Utms;
  fbclid: string | null;
  booking_date_time: string;
  temporal_booking_token: string | null;
  booking_token: string | null;
  slot_reservation_expires_at: string | null;
  redirect_url_accepted: boolean | null;
  value: number;
  currency: "CLP";
  dry_run: boolean;
}

export interface ConversionReturnPayload {
  event: "booking_return";
  occurred_at: string;
  event_id: string | null;
  contactId: string | null;
  utms: Utms;
  fbclid: string | null;
  value: number | null;
  currency: "CLP";
  /**
   * true solo si CONVERSION_EVENTS_ENABLED=true y (si está configurado)
   * PAYMENT_SUCCESS_PARAM coincide. n8n debe disparar CAPI Purchase SOLO si es true.
   */
  conversion_confirmed: boolean;
  /** Todos los query params tal cual llegaron (para inspeccionar qué agrega Encuadrado) */
  raw_query_params: Record<string, string | string[]>;
  fbp: string | null;
  fbc: string | null;
  client_ip: string | null;
  user_agent: string | null;
  page_url: string | null;
}
