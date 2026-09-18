import { isPaymentConfirmed } from "@/lib/conversion";
import { logger } from "@/lib/logger";
import { parseReturnParams, rawParamsToObject } from "@/lib/tracking/params";
import { ConfirmationClient } from "./ConfirmationClient";

export const metadata = {
  title: "Agendamiento | Cris Tributario",
};

export default async function AgendamientoExitosoPage({
  searchParams,
}: PageProps<"/agendamiento-exitoso">) {
  const params = await searchParams;
  const parsed = parseReturnParams(params);
  const conversionConfirmed = isPaymentConfirmed(params);

  // Loguea TODOS los query params: así vemos qué agrega Encuadrado al redirect
  // (estado de pago, tokens, etc.) en la primera reserva real.
  logger.info("exitoso.return_visit", {
    event_id: parsed.eventId ?? null,
    contactId: parsed.contactId ?? null,
    conversion_confirmed: conversionConfirmed,
    raw_query_params: rawParamsToObject(params),
  });

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:py-16">
      <ConfirmationClient
        eventId={parsed.eventId ?? null}
        value={parsed.value}
        slot={parsed.slot}
        conversionConfirmed={conversionConfirmed}
      />
    </main>
  );
}
