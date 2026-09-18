/**
 * Datos fijos del servicio que se agenda.
 *
 * La duración y el título se verificaron contra la API real de Encuadrado
 * (2026-09-17): slots de 60 minutos, título
 * "Asesoría de Arquitectura Tributaria con Cris.Tributario".
 */
export const SERVICE_TITLE = "Asesoría de Arquitectura Tributaria";
export const SERVICE_DURATION_MINUTES = 60;

/**
 * Pasos que se muestran en la página de gracias.
 * BORRADOR: confirmar el contenido con Cris antes de dar por cerrada la página.
 */
export const NEXT_STEPS: { title: string; body: string }[] = [
  {
    title: "Revisa tu email",
    body: "Encuadrado te envía la confirmación con el link de la videollamada. Si no lo ves en unos minutos, revisa spam o promociones.",
  },
  {
    title: "Prepara tus antecedentes",
    body: "Ten a mano la lista de tus propiedades (dirección o rol), los créditos hipotecarios vigentes, contratos de arriendo y tu última declaración de renta (F22).",
  },
  {
    title: "Conéctate 5 minutos antes",
    body: "Idealmente desde un computador con buena conexión, para revisar tus números en pantalla con Cris.",
  },
];

/**
 * Valida un horario recibido por URL: ISO-8601 real, en una ventana razonable
 * (desde ayer hasta 90 días). Devuelve el ISO normalizado o null.
 */
export function parseSlot(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  if (ms < now - DAY || ms > now + 90 * DAY) return null;
  return new Date(ms).toISOString();
}

export function slotEnd(startIso: string): string {
  return new Date(
    Date.parse(startIso) + SERVICE_DURATION_MINUTES * 60 * 1000,
  ).toISOString();
}
