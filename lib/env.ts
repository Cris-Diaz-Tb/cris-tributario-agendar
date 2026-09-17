import "server-only";

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

function bool(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
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
  get servicePriceClp(): number {
    const raw = optional("SERVICE_PRICE_CLP");
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
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
