import "server-only";

import { env } from "@/lib/env";
import { rawParamsToObject } from "@/lib/tracking/params";

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

/**
 * ¿Consideramos que este retorno a /agendamiento-exitoso es un pago confirmado?
 *
 * No sabemos aún si Encuadrado redirige también en cancelación/fallo, así que:
 *  - CONVERSION_EVENTS_ENABLED=false (default) → nunca.
 *  - CONVERSION_EVENTS_ENABLED=true sin PAYMENT_SUCCESS_PARAM → siempre.
 *  - CONVERSION_EVENTS_ENABLED=true con PAYMENT_SUCCESS_PARAM=clave=valor → solo si coincide.
 *
 * Se decide SIEMPRE en el servidor; el navegador no puede forzarlo.
 */
export function isPaymentConfirmed(params: RawParams): boolean {
  if (!env.conversionEventsEnabled) return false;
  const rule = env.paymentSuccessParam;
  if (!rule) return true;
  const value = rawParamsToObject(params)[rule.key];
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.includes(rule.value);
}
