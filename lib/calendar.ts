import { SERVICE_TITLE, slotEnd } from "@/lib/service";

const EVENT_TITLE = `${SERVICE_TITLE} · Cris Tributario`;
const EVENT_DETAILS =
  "El link de la videollamada llega en el email de confirmación de Encuadrado. " +
  "Ten a mano la lista de tus propiedades, créditos hipotecarios, contratos de arriendo y tu última declaración de renta.";

/** 2026-09-22T17:00:00.000Z → 20260922T170000Z */
function toCalendarStamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(startIso: string): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", EVENT_TITLE);
  url.searchParams.set(
    "dates",
    `${toCalendarStamp(startIso)}/${toCalendarStamp(slotEnd(startIso))}`,
  );
  url.searchParams.set("details", EVENT_DETAILS);
  return url.toString();
}

/** Escapa texto para iCalendar (RFC 5545 §3.3.11). */
function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Archivo .ics con recordatorio 30 minutos antes. */
export function buildIcs(startIso: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cris Tributario//Agendamiento//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${toCalendarStamp(startIso)}-asesoria@cristributario.cl`,
    `DTSTAMP:${toCalendarStamp(new Date().toISOString())}`,
    `DTSTART:${toCalendarStamp(startIso)}`,
    `DTEND:${toCalendarStamp(slotEnd(startIso))}`,
    `SUMMARY:${icsText(EVENT_TITLE)}`,
    `DESCRIPTION:${icsText(EVENT_DETAILS)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tu asesoría con Cris Tributario comienza en 30 minutos",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
