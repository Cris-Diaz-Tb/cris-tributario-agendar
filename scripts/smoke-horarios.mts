/**
 * Smoke test: llamada REAL a GET available-time-slots de Encuadrado (solo lectura,
 * no crea reservas). Uso:
 *
 *   npm run smoke:horarios
 *
 * Lee ENCUADRADO_API_KEY y ENCUADRADO_SERVICE_UUID desde .env.local.
 * Nunca imprime la API key.
 */

const BASE_URL = "https://encuadrado.com/api/public/v1";

const apiKey = process.env.ENCUADRADO_API_KEY?.trim();
const serviceUuid = process.env.ENCUADRADO_SERVICE_UUID?.trim();

if (!apiKey || !serviceUuid) {
  console.error(
    "Faltan ENCUADRADO_API_KEY o ENCUADRADO_SERVICE_UUID en .env.local",
  );
  process.exit(1);
}

const start = new Date();
const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
const url = new URL(
  `${BASE_URL}/services/${encodeURIComponent(serviceUuid)}/available-time-slots`,
);
url.searchParams.set("start", start.toISOString());
url.searchParams.set("end", end.toISOString());

const res = await fetch(url, {
  headers: { "X-API-Key": apiKey, Accept: "application/json" },
});

console.log(`HTTP ${res.status}`);
for (const h of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
  console.log(`${h}: ${res.headers.get(h) ?? "(no viene)"}`);
}

const text = await res.text();
if (!res.ok) {
  console.log("Body de error:", text.slice(0, 500));
  process.exit(1);
}

const slots = JSON.parse(text) as Array<{ start: string; end: string }>;
const fmt = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  dateStyle: "full",
  timeStyle: "short",
});
console.log(`Slots en los próximos 14 días: ${slots.length}`);
for (const s of slots.slice(0, 10)) {
  console.log(`  ${s.start}  →  ${fmt.format(new Date(s.start))} (Chile)`);
}
if (slots.length > 10) console.log(`  … y ${slots.length - 10} más`);
