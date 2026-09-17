import type { EncuadradoErrorBody } from "@/types/encuadrado";

export type EncuadradoOperation = "slots" | "booking";

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;

/**
 * Extrae code/detail/field de las formas posibles:
 *  {"error":"UNAUTHORIZED"}                                  ← verificado en la API real
 *  {"error":"BOOKING_FAILED","detail":"...","field":"..."}
 *  {"error":{"code":"...","detail":"...","field":"..."}}
 *  {"code":"...","detail":"...","field":"..."}
 */
export function normalizeErrorBody(body: EncuadradoErrorBody | null): {
  code?: string;
  detail?: string;
  field?: string;
} {
  if (!body || typeof body !== "object") return {};
  const nested =
    body.error && typeof body.error === "object" ? body.error : undefined;
  return {
    code: str(body.error) ?? str(nested?.code) ?? str(body.code),
    detail: str(body.detail) ?? str(nested?.detail),
    field: str(body.field) ?? str(nested?.field),
  };
}

/** Error de Encuadrado (o de red hacia Encuadrado) normalizado. */
export class EncuadradoError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly detail: string | undefined;
  readonly field: string | undefined;

  constructor(status: number, body: EncuadradoErrorBody | null) {
    const { code, detail, field } = normalizeErrorBody(body);
    super(`Encuadrado ${status}${code ? ` ${code}` : ""}`);
    this.name = "EncuadradoError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.field = field;
  }
}

/** status 0 = no hubo respuesta (timeout, DNS, conexión) */
export const NETWORK_ERROR_STATUS = 0;

export interface UserFacingError {
  message: string;
  field?: string;
  retryable: boolean;
}

/**
 * Traduce un error de Encuadrado a un mensaje en español para el usuario.
 * Nunca incluye jerga técnica ni códigos.
 */
export function toUserFacingError(
  err: unknown,
  operation: EncuadradoOperation,
): UserFacingError {
  if (!(err instanceof EncuadradoError)) {
    return {
      message:
        "Ocurrió un problema inesperado. Intenta de nuevo en un momento.",
      retryable: true,
    };
  }

  switch (err.status) {
    case NETWORK_ERROR_STATUS:
      return {
        message:
          "No pudimos conectarnos con el sistema de agenda. Revisa tu conexión e intenta de nuevo.",
        retryable: true,
      };

    case 400:
      if (err.code === "BOOKING_FAILED" || (!err.code && err.detail)) {
        // Encuadrado devuelve mensajes de validación legibles: se muestran tal cual.
        return {
          message:
            err.detail ??
            "No pudimos reservar ese horario. Revisa tus datos o elige otro horario.",
          field: err.field,
          retryable: false,
        };
      }
      if (err.code === "INVALID_DATE") {
        return {
          message:
            operation === "slots"
              ? "No pudimos cargar los horarios, intenta de nuevo en un momento."
              : "El horario seleccionado ya no es válido. Por favor elige otro.",
          field: operation === "booking" ? "booking_date_time" : undefined,
          retryable: true,
        };
      }
      return {
        message:
          "Algunos datos no son válidos. Revísalos e intenta de nuevo.",
        field: err.field,
        retryable: false,
      };

    case 401:
      return {
        message:
          "Estamos con un problema técnico en el sistema de agenda. Por favor escríbenos y te ayudamos a agendar.",
        retryable: false,
      };

    case 404:
      return {
        message:
          "Esta asesoría no está disponible para agendar en este momento. Por favor escríbenos y te ayudamos.",
        retryable: false,
      };

    case 429:
      return {
        message:
          "Hay muchas personas agendando en este momento. Espera un minuto e intenta de nuevo.",
        retryable: true,
      };

    case 503:
      return {
        message:
          operation === "slots"
            ? "No pudimos cargar los horarios, intenta de nuevo en un momento."
            : "No pudimos confirmar la disponibilidad del horario. Intenta de nuevo en un momento.",
        retryable: true,
      };

    default:
      return {
        message:
          operation === "slots"
            ? "No pudimos cargar los horarios, intenta de nuevo en un momento."
            : "El sistema de agenda tuvo un problema al reservar. Intenta de nuevo en unos minutos.",
        retryable: true,
      };
  }
}

/** Status HTTP que devolvemos al frontend para cada error. */
export function toHttpStatus(err: unknown): number {
  if (!(err instanceof EncuadradoError)) return 500;
  if (err.status === NETWORK_ERROR_STATUS) return 502;
  if (err.status === 401 || err.status === 404) return 502; // problema nuestro, no del usuario
  return err.status;
}
