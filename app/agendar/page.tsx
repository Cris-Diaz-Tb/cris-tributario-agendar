import { env } from "@/lib/env";
import { parseAttribution } from "@/lib/tracking/params";
import { BookingFlow } from "./_components/BookingFlow";

export default async function AgendarPage({
  searchParams,
}: PageProps<"/agendar">) {
  const attribution = parseAttribution(await searchParams);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Cris Tributario
        </p>
        <h1 className="mt-2 text-2xl font-bold text-brand sm:text-3xl">
          Agenda tu asesoría tributaria inmobiliaria
        </h1>
        <p className="mt-2 text-slate-600">
          Elige el horario que más te acomode, completa tus datos y confirma
          tu reserva con el pago.
        </p>
      </header>

      <BookingFlow attribution={attribution} termsUrl={env.termsUrl} />
    </main>
  );
}
