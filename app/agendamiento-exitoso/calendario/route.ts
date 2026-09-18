import { buildIcs } from "@/lib/calendar";
import { parseSlot } from "@/lib/service";

/**
 * GET /agendamiento-exitoso/calendario?slot=<ISO>
 * Descarga el evento de la asesoría como .ics (Apple Calendar, Outlook).
 * Vive bajo /agendamiento-exitoso para que el Worker de Cloudflare lo proxyee.
 */
export async function GET(request: Request) {
  const slot = parseSlot(new URL(request.url).searchParams.get("slot"));
  if (!slot) {
    return new Response("Horario inválido", { status: 400 });
  }
  return new Response(buildIcs(slot), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="asesoria-cris-tributario.ics"',
      "Cache-Control": "no-store",
    },
  });
}
