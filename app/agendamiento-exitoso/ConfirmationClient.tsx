"use client";

import { useEffect } from "react";

import { pushDataLayer } from "@/lib/datalayer";
import { readCookie, trackMetaEvent } from "@/lib/meta-pixel";
import { API_ROUTES } from "@/lib/routes";

interface Props {
  eventId: string | null;
  value: number | null;
  /** Decidido en el servidor (CONVERSION_EVENTS_ENABLED + PAYMENT_SUCCESS_PARAM). */
  conversionConfirmed: boolean;
}

const SENT_KEY_PREFIX = "ct_return_sent:";

/** sessionStorage puede lanzar (modo privado, cookies bloqueadas). */
function alreadySent(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function markSent(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // sin sessionStorage: se acepta el riesgo de duplicado (n8n debe ser idempotente por event_id)
  }
}

/** Espera a que el script del Pixel defina fbq (se carga afterInteractive). */
function whenPixelReady(cb: () => void, timeoutMs = 3000) {
  const started = Date.now();
  const tick = () => {
    if (typeof window.fbq === "function" || Date.now() - started > timeoutMs) {
      cb();
      return;
    }
    setTimeout(tick, 100);
  };
  tick();
}

export function ConfirmationClient({ eventId, value, conversionConfirmed }: Props) {
  useEffect(() => {
    const dedupeKey = SENT_KEY_PREFIX + (eventId ?? window.location.search);
    if (alreadySent(dedupeKey)) return; // recarga o "atrás": no repetir

    // Se marca como enviado recién al disparar (no al montar), para que el doble
    // montaje de StrictMode no cancele el envío. La espera también le da tiempo
    // al Pixel para setear _fbp/_fbc.
    const timer = setTimeout(() => {
      if (alreadySent(dedupeKey)) return;
      markSent(dedupeKey);

      pushDataLayer("ct_retorno_pago", {
        event_id: eventId,
        value: value,
        currency: "CLP",
        conversion_confirmed: conversionConfirmed,
      });

      // 1) Pixel en el navegador — SOLO si el servidor confirmó la conversión.
      if (conversionConfirmed && eventId) {
        whenPixelReady(() => {
          const params = {
            value: value ?? 0,
            currency: "CLP",
            content_name: "Asesoría tributaria inmobiliaria",
          };
          trackMetaEvent("Schedule", params, eventId);
          trackMetaEvent("Purchase", params, eventId);
        });
      }

      // 2) Fire-and-forget a n8n vía nuestro route handler (siempre, para trazabilidad).
      const url = new URL(window.location.href);
      const rawQueryParams: Record<string, string | string[]> = {};
      for (const key of new Set(url.searchParams.keys())) {
        const all = url.searchParams.getAll(key);
        rawQueryParams[key] = all.length === 1 ? all[0] : all;
      }
      void fetch(API_ROUTES.notificarConversion, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          raw_query_params: rawQueryParams,
          page_url: url.origin + url.pathname,
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
        }),
      }).catch(() => {
        // no bloquea la UI
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [eventId, value, conversionConfirmed]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {conversionConfirmed ? (
        <>
          <h1 className="mt-5 text-2xl font-bold text-brand">
            ¡Tu asesoría quedó agendada!
          </h1>
          <p className="mt-3 text-slate-600">
            Te enviamos un email con el detalle de tu reserva y el link de la
            reunión. Revisa también tu carpeta de spam.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-5 text-2xl font-bold text-brand">
            ¡Gracias por agendar con Cris Tributario!
          </h1>
          <p className="mt-3 text-slate-600">
            Si completaste el pago, tu asesoría quedó agendada y recibirás un
            email con el detalle de tu reserva. Si no te llega en unos minutos,
            revisa tu carpeta de spam o escríbenos.
          </p>
          <a
            href="/agendar"
            className="mt-6 inline-block text-sm font-semibold text-brand underline"
          >
            ¿No alcanzaste a pagar? Vuelve a elegir un horario
          </a>
        </>
      )}
    </div>
  );
}
