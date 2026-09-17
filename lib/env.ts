import "server-only";

import { logger } from "@/lib/logger";

/**
 * Variables de entorno server-side. Se leen de forma perezosa (no al importar)
 * para que `next build` no falle si faltan; fallan al usarse.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Estricto a propósito: solo el string "true" activa el flag.
 * Cualquier otro valor (incluido "True " con espacios, "1" o "yes") lo deja en false
 * y deja un aviso en los logs para que no se diagnostique a ciegas.
 */
function bool(name: string): boolean {
  const rawValue = process.env[name];
  if (rawValue === undefined) return false;
  const normalized = rawValue.trim().toLowerCase();
  if (normalized !== "" && normalized !== "true" && normalized !== "false") {
    logger.warn(
      "config.bool_no_reconocido",
      { variable: name, valor_recibido: rawValue, interpretado_como: false },
      "medium",
    );
  }
  return normalized === "true";
}

export const env = {
  get encuadradoApiKey(): string | undefined {
    return optional("ENCUADRADO_API_KEY");
  },
  get encuadradoServiceUuid(): string {
    return required("ENCUADRADO_SERVICE_UUID");
  },
  /** Sin slash final */
  get siteUrl(): string {
    return required("SITE_URL").replace(/\/+$/, "");
  },
  get n8nWebhookUrl(): string | undefined {
    return optional("N8N_WEBHOOK_URL");
  },
  /** Secreto compartido con n8n; viaja en el header X-CT-Webhook-Secret. Nunca se loguea. */
  get n8nWebhookSecret(): string | undefined {
    return optional("N8N_WEBHOOK_SECRET");
  },
  /**
   * Entero en CLP. Acepta separadores de miles chilenos ("45.000", "45 000")
   * porque Number.parseInt("45.000") daría 45 en silencio.
   * Cualquier otra cosa → 0 y aviso en los logs.
   */
  get servicePriceClp(): number {
    const rawValue = optional("SERVICE_PRICE_CLP");
    if (!rawValue) {
      logger.warn(
        "config.service_price_sin_definir",
        { variable: "SERVICE_PRICE_CLP" },
        "medium",
      );
      return 0;
    }
    const cleaned = rawValue.replace(/[.\s_]/g, "");
    if (!/^\d+$/.test(cleaned)) {
      logger.error(
        "config.service_price_invalido",
        { variable: "SERVICE_PRICE_CLP", valor_recibido: rawValue },
        "high",
      );
      return 0;
    }
    const n = Number.parseInt(cleaned, 10);
    if (cleaned !== rawValue) {
      logger.warn("config.service_price_normalizado", {
        valor_recibido: rawValue,
        interpretado_como: n,
      });
    }
    return n > 0 ? n : 0;
  },
  get termsUrl(): string {
    return (
      optional("TERMS_URL") ?? "https://cristributario.cl/terminos-y-condiciones"
    );
  },
  get dryRun(): boolean {
    return bool("ENCUADRADO_DRY_RUN");
  },
  get dryRunScenario(): string {
    return optional("ENCUADRADO_DRY_RUN_SCENARIO") ?? "prepaid";
  },
  get conversionEventsEnabled(): boolean {
    return bool("CONVERSION_EVENTS_ENABLED");
  },
  /** Formato "clave=valor", ej. "status=paid" */
  get paymentSuccessParam(): { key: string; value: string } | undefined {
    const raw = optional("PAYMENT_SUCCESS_PARAM");
    if (!raw || !raw.includes("=")) return undefined;
    const idx = raw.indexOf("=");
    return { key: raw.slice(0, idx), value: raw.slice(idx + 1) };
  },
};
