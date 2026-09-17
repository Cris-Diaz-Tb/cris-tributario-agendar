import { redirect } from "next/navigation";

/** La raíz no se proxyea desde cristributario.cl; en el dominio de Vercel lleva a /agendar. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const query = qs.toString();
  redirect(query ? `/agendar?${query}` : "/agendar");
}
