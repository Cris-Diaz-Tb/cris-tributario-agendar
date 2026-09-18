"use client";

import { useEffect } from "react";

import { longLabel } from "@/app/agendar/_components/format";
import { googleCalendarUrl } from "@/lib/calendar";
import { pushDataLayer } from "@/lib/datalayer";
import { readCookie, trackMetaEvent } from "@/lib/meta-pixel";
import { API_ROUTES, SUCCESS_PATH } from "@/lib/routes";
import { NEXT_STEPS } from "@/lib/service";

interface Props {
  eventId: string | null;
  value: number | null;
  /** Horario agendado (ISO), o null si la URL no lo trae */
  slot: string | null;
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

export function ConfirmationClient({
  eventId,
  value,
  slot,
  conversionConfirmed,
}: Props) {
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
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-accent">
          ● Cris Tributario
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase leading-tight text-white sm:text-4xl">
          {conversionConfirmed ? (
            <>
              ¡Tu asesoría quedó <span className="italic text-accent">agendada</span>!
            </>
          ) : (
            <>
              ¡Gracias por <span className="italic text-accent">agendar</span>!
            </>
          )}
        </h1>

        {slot ? (
          <div className="mt-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-4">
            <p className="text-sm text-muted">
              {conversionConfirmed
                ? "Tu sesión es el"
                : "Si completaste el pago, tu sesión es el"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-white">
              {longLabel(slot)} hrs
            </p>
            <p className="mt-1 text-xs text-muted">Hora de Chile continental · 60 minutos</p>
          </div>
        ) : (
          <p className="mt-4 text-muted">
            {conversionConfirmed
              ? "Te enviamos un email con el detalle de tu reserva."
              : "Si completaste el pago, tu asesoría quedó agendada y recibirás un email con el detalle."}
          </p>
        )}

        {slot && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              href={googleCalendarUrl(slot)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[14px] bg-accent px-4 py-3 font-display text-lg font-bold text-accent-ink transition hover:brightness-110"
            >
              Agregar a Google Calendar
            </a>
            <a
              href={`${SUCCESS_PATH}/calendario?slot=${encodeURIComponent(slot)}`}
              className="rounded-[14px] border border-accent/60 px-4 py-3 font-display text-lg font-bold text-accent transition hover:bg-accent/10"
            >
              Apple / Outlook (.ics)
            </a>
          </div>
        )}
      </section>

      <section
        aria-labelledby="next-steps-title"
        className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
      >
        <h2
          id="next-steps-title"
          className="font-display text-2xl font-bold uppercase text-white"
        >
          Qué sigue
        </h2>
        <ol className="mt-5 space-y-5">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-accent-ink">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!conversionConfirmed && (
        <p className="text-center text-sm text-muted">
          ¿No alcanzaste a pagar?{" "}
          <a href="/agendar" className="font-semibold text-accent underline">
            Vuelve a elegir un horario
          </a>
        </p>
      )}
    </div>
  );
}
