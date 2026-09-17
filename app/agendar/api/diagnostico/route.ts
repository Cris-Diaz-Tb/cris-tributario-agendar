import { NextResponse } from "next/server";

import { env } from "@/lib/env";

/**
 * Diagnóstico de configuración: qué lee realmente el runtime.
 * NO devuelve valores secretos: de la API key y del webhook solo dice si existen
 * y cuántos caracteres tienen.
 *
 * Los flags de comportamiento (ENCUADRADO_DRY_RUN, SERVICE_PRICE_CLP,
 * CONVERSION_EVENTS_ENABLED) sí se muestran en crudo, porque son los que hay
 * que verificar y no son secretos.
 */
export const dynamic = "force-dynamic";

const raw = (name: string) => {
  const v = process.env[name];
  if (v === undefined) return { set: false as const };
  return {
    set: true as const,
    value: v,
    length: v.length,
    // detecta espacios o comillas pegadas al valor al copiar/pegar en Vercel
    needs_trim: v !== v.trim(),
    quoted: /^["'].*["']$/.test(v.trim()),
  };
};

const presence = (name: string) => {
  const v = process.env[name];
  return { set: !!v?.trim(), length: v?.trim().length ?? 0 };
};

export async function GET() {
  return NextResponse.json(
    {
      deployment: {
        vercel_env: process.env.VERCEL_ENV ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        deployment_url: process.env.VERCEL_URL ?? null,
        region: process.env.VERCEL_REGION ?? null,
        now: new Date().toISOString(),
      },
      // Lo que el código realmente usa
      efectivo: {
        dryRun: env.dryRun,
        servicePriceClp: env.servicePriceClp,
        conversionEventsEnabled: env.conversionEventsEnabled,
        dryRunScenario: env.dryRunScenario,
        siteUrl: safe(() => env.siteUrl),
        serviceUuidPresente: safe(() => !!env.encuadradoServiceUuid),
        paymentSuccessParam: env.paymentSuccessParam ?? null,
      },
      // Valores crudos, tal como llegan del entorno
      crudo: {
        ENCUADRADO_DRY_RUN: raw("ENCUADRADO_DRY_RUN"),
        SERVICE_PRICE_CLP: raw("SERVICE_PRICE_CLP"),
        CONVERSION_EVENTS_ENABLED: raw("CONVERSION_EVENTS_ENABLED"),
        ENCUADRADO_DRY_RUN_SCENARIO: raw("ENCUADRADO_DRY_RUN_SCENARIO"),
        SITE_URL: raw("SITE_URL"),
        PAYMENT_SUCCESS_PARAM: raw("PAYMENT_SUCCESS_PARAM"),
      },
      // Secretos: solo si existen
      secretos: {
        ENCUADRADO_API_KEY: presence("ENCUADRADO_API_KEY"),
        ENCUADRADO_SERVICE_UUID: presence("ENCUADRADO_SERVICE_UUID"),
        N8N_WEBHOOK_URL: presence("N8N_WEBHOOK_URL"),
        NEXT_PUBLIC_META_PIXEL_ID: presence("NEXT_PUBLIC_META_PIXEL_ID"),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function safe<T>(fn: () => T): T | string {
  try {
    return fn();
  } catch (err) {
    return err instanceof Error ? `ERROR: ${err.message}` : "ERROR";
  }
}
