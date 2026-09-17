export const TIME_ZONE = "America/Santiago";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: TIME_ZONE,
  weekday: "short",
});

const dayNumFmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

const timeFmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const longFmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "2026-06-22" en hora de Chile */
export const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
export const weekdayLabel = (iso: string) =>
  weekdayFmt.format(new Date(iso)).replace(".", "");
export const dayLabel = (iso: string) =>
  dayNumFmt.format(new Date(iso)).replace(".", "");
export const timeLabel = (iso: string) => timeFmt.format(new Date(iso));
/** "Viernes, 18 de septiembre, 11:00" (solo la primera letra en mayúscula) */
export const longLabel = (iso: string) => {
  const label = longFmt.format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
};
