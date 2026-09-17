import "server-only";

type Level = "info" | "warn" | "error";
type Severity = "low" | "medium" | "high" | "critical";

/**
 * Logs estructurados (JSON de una línea) para Vercel Logs.
 * Solo corre en el servidor; nunca se devuelve al navegador.
 * Redacta la API key y el secreto de n8n por si algún objeto los arrastra.
 */
function redact(line: string): string {
  let out = line;
  for (const name of ["ENCUADRADO_API_KEY", "N8N_WEBHOOK_SECRET"]) {
    const value = process.env[name]?.trim();
    if (value) out = out.split(value).join("[REDACTED]");
  }
  return out;
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
