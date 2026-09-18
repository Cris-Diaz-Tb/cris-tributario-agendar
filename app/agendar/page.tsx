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
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
          ● Cris Tributario · Asesoría 1 a 1
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold uppercase leading-tight text-white sm:text-4xl">
          Agenda tu asesoría{" "}
          <span className="italic text-accent">tributaria</span> inmobiliaria
        </h1>
        <p className="mt-3 text-muted">
          Elige el horario que más te acomode, completa tus datos y confirma
          tu reserva con el pago.
        </p>
      </header>

      <BookingFlow attribution={attribution} termsUrl={env.termsUrl} />
    </main>
  );
}
