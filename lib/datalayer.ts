/**
 * Eventos propios hacia el dataLayer de GTM.
 *
 * Sirven como disparadores estables en GTM ("Evento personalizado" con estos
 * nombres), en vez de depender de selectores de botones que se rompen al
 * cambiar la interfaz. Si GTM no está instalado, el push queda igual en el
 * array y no pasa nada.
 *
 * Nunca se envían datos personales (nombre, email, teléfono) al dataLayer.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export type DataLayerEvent =
  /** El usuario eligió un horario en el selector */
  | "ct_horario_seleccionado"
  /** Reserva temporal creada; el usuario va camino al pago */
  | "ct_reserva_iniciada"
  /** El usuario volvió desde Encuadrado a la página de confirmación */
  | "ct_retorno_pago";

export function pushDataLayer(
  event: DataLayerEvent,
  data: Record<string, string | number | boolean | null> = {},
): void {
  try {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...data });
  } catch {
    // el tracking nunca debe romper el flujo del usuario
  }
}
