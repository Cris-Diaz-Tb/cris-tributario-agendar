"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { trackMetaEvent } from "@/lib/meta-pixel";
import { API_ROUTES } from "@/lib/routes";
import type {
  ApiErrorResponse,
  AttributionContext,
  HorariosResponse,
  ReservarRequest,
  ReservarSuccess,
} from "@/types/tracking";
import {
  ContactForm,
  type ContactField,
  type ContactValues,
  type FieldErrors,
} from "./ContactForm";
import { longLabel, timeLabel } from "./format";
import { SlotPicker, type SlotsState } from "./SlotPicker";

/** Tiempo para que el request del Pixel salga antes de abandonar la página. */
const PIXEL_FLUSH_MS = 400;

const GENERIC_ERROR =
  "Ocurrió un problema inesperado. Intenta de nuevo en un momento.";

/** Campos que Encuadrado puede devolver en `field` → campo de nuestro formulario. */
const ENCUADRADO_FIELD_MAP: Record<string, ContactField | "slot"> = {
  full_name: "full_name",
  email: "email",
  phone: "phone",
  phone_country_code: "phone",
  booking_date_time: "slot",
  terms_and_conditions: "terms",
  terms: "terms",
};

interface Props {
  attribution: AttributionContext;
  termsUrl: string;
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "redirecting"; expiresAt?: string };

function validateLocally(
  values: ContactValues,
  slot: string | null,
): { fieldErrors: FieldErrors; slotError?: string } {
  const fieldErrors: FieldErrors = {};
  if (values.full_name.trim().length < 3) {
    fieldErrors.full_name = "Ingresa tu nombre completo.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    fieldErrors.email = "Ingresa un email válido.";
  }
  const digits = values.phone.replace(/\D/g, "").replace(/^56(?=\d{9}$)/, "");
  if (!/^\d{9}$/.test(digits)) {
    fieldErrors.phone = "Ingresa un teléfono de 9 dígitos (ej. 9 1234 5678).";
  }
  if (!values.terms) {
    fieldErrors.terms = "Debes aceptar los términos y condiciones.";
  }
  return {
    fieldErrors,
    slotError: slot ? undefined : "Elige un horario para continuar.",
  };
}

export function BookingFlow({ attribution, termsUrl }: Props) {
  const [slotsState, setSlotsState] = useState<SlotsState>({ status: "loading" });
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [values, setValues] = useState<ContactValues>({
    full_name: "",
    email: "",
    phone: "",
    terms: false,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [slotError, setSlotError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const inFlight = useRef(false);

  const loadSlots = useCallback(async () => {
    setSlotsState({ status: "loading" });
    try {
      const res = await fetch(API_ROUTES.horarios, { cache: "no-store" });
      const json = (await res.json()) as HorariosResponse | ApiErrorResponse;
      if (!res.ok || "error" in json) {
        setSlotsState({
          status: "error",
          message:
            "error" in json
              ? json.error.message
              : "No pudimos cargar los horarios, intenta de nuevo en un momento.",
        });
        return;
      }
      setSlotsState({ status: "ready", slots: json.slots });
    } catch {
      setSlotsState({
        status: "error",
        message:
          "No pudimos cargar los horarios. Revisa tu conexión e intenta de nuevo.",
      });
    }
  }, []);

  useEffect(() => {
    // Carga inicial de datos externos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    // Si el usuario vuelve con "atrás" desde Encuadrado, el navegador puede restaurar
    // la página congelada en "Redirigiendo al pago…": la desbloqueamos.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        inFlight.current = false;
        setSubmit({ status: "idle" });
        void loadSlots();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [loadSlots]);

  const handleSelectSlot = (start: string) => {
    setSelectedSlot(start);
    setSlotError(undefined);
    setFormError(undefined);
  };

  const handleChange = (next: ContactValues) => {
    setValues(next);
    // Limpia el error del campo que el usuario está corrigiendo.
    setFieldErrors((prev) => {
      const copy = { ...prev };
      for (const key of Object.keys(copy) as ContactField[]) {
        if (next[key] !== values[key]) delete copy[key];
      }
      return copy;
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // evita doble clic → doble reserva temporal

    setFormError(undefined);
    const local = validateLocally(values, selectedSlot);
    setFieldErrors(local.fieldErrors);
    setSlotError(local.slotError);
    if (local.slotError || Object.keys(local.fieldErrors).length > 0) return;

    inFlight.current = true;
    setSubmit({ status: "submitting" });

    const payload: ReservarRequest = {
      contactId: attribution.contactId,
      utms: attribution.utms,
      fbclid: attribution.fbclid,
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      phone: values.phone,
      booking_date_time: selectedSlot as string,
      terms_accepted: values.terms,
    };

    try {
      const res = await fetch(API_ROUTES.reservar, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ReservarSuccess | ApiErrorResponse;

      if (!res.ok || "error" in json) {
        const err = "error" in json ? json.error : { message: GENERIC_ERROR };
        applyServerError(err.message, "field" in err ? err.field : undefined);
        inFlight.current = false;
        setSubmit({ status: "idle" });
        return;
      }

      if (json.kind === "payment_required") {
        setSubmit({ status: "redirecting", expiresAt: json.expires_at });
        trackMetaEvent(
          "InitiateCheckout",
          {
            value: json.value,
            currency: "CLP",
            content_name: "Asesoría tributaria inmobiliaria",
            num_items: 1,
          },
          json.event_id,
        );
        await new Promise((r) => setTimeout(r, PIXEL_FLUSH_MS));
        window.location.assign(json.payment_url);
        return;
      }

      // Confirmada sin prepago → directo a la página de éxito.
      setSubmit({ status: "redirecting" });
      window.location.assign(json.success_url);
    } catch {
      setFormError(
        "No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.",
      );
      inFlight.current = false;
      setSubmit({ status: "idle" });
    }
  }

  function applyServerError(message: string, field?: string) {
    const mapped = field ? ENCUADRADO_FIELD_MAP[field] : undefined;
    if (mapped === "slot") {
      setSlotError(message);
      setSelectedSlot(null);
      void loadSlots(); // el horario probablemente se ocupó: refrescar
    } else if (mapped) {
      setFieldErrors((prev) => ({ ...prev, [mapped]: message }));
    } else {
      // Campo desconocido (ej. "comuna"): mostrar el detalle tal cual.
      setFormError(message);
    }
  }

  const busy = submit.status !== "idle";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <SlotPicker
        state={slotsState}
        selected={selectedSlot}
        onSelect={handleSelectSlot}
        onRetry={() => void loadSlots()}
        highlightError={!!slotError}
      />
      {slotError && (
        <p role="alert" className="-mt-2 text-sm text-red-600">
          {slotError}
        </p>
      )}

      <ContactForm
        values={values}
        errors={fieldErrors}
        disabled={busy}
        termsUrl={termsUrl}
        onChange={handleChange}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {selectedSlot ? (
          <p className="text-slate-700">
            Horario elegido:{" "}
            <span className="font-semibold text-brand">
              {longLabel(selectedSlot)} hrs
            </span>
          </p>
        ) : (
          <p className="text-slate-500">Aún no eliges un horario.</p>
        )}

        {formError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || slotsState.status !== "ready"}
          className="mt-4 w-full rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submit.status === "submitting"
            ? "Reservando tu horario…"
            : submit.status === "redirecting"
              ? "Redirigiendo al pago…"
              : "Reservar y pagar"}
        </button>

        {submit.status === "redirecting" && submit.expiresAt && (
          <p className="mt-3 text-center text-sm text-slate-600">
            Tu horario quedó reservado temporalmente hasta las{" "}
            {timeLabel(submit.expiresAt)} hrs. Completa el pago para confirmarlo.
          </p>
        )}
        {submit.status === "idle" && (
          <p className="mt-3 text-center text-xs text-slate-500">
            Serás redirigido a Encuadrado para completar el pago de forma segura.
          </p>
        )}
      </div>
    </form>
  );
}
