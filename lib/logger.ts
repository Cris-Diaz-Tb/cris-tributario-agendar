import "server-only";

type Level = "info" | "warn" | "error";
type Severity = "low" | "medium" | "high" | "critical";

/**
 * Logs estructurados (JSON de una línea) para Vercel Logs.
 * Solo corre en el servidor; nunca se devuelve al navegador.
 * Redacta la API key por si algún objeto la arrastra accidentalmente.
 */
function redact(line: string): string {
  const key = process.env.ENCUADRADO_API_KEY?.trim();
  return key ? line.split(key).join("[REDACTED]") : line;
}

function write(
  level: Level,
  msg: string,
  data: Record<string, unknown> = {},
  severity?: Severity,
) {
  const entry = {
    level,
    ...(severity ? { severity } : {}),
    msg,
    time: new Date().toISOString(),
    ...data,
  };
  let line: string;
  try {
    line = redact(JSON.stringify(entry));
  } catch {
    line = redact(JSON.stringify({ level, msg, time: entry.time }));
  }
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) =>
    write("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>, severity?: Severity) =>
    write("warn", msg, data, severity),
  error: (msg: string, data?: Record<string, unknown>, severity?: Severity) =>
    write("error", msg, data, severity ?? "high"),
};
