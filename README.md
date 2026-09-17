# Cris Tributario — Agendamiento con pago

App Next.js 16 (App Router, TypeScript estricto, Tailwind 4) para agendar la asesoría tributaria
inmobiliaria vía la API pública de **Encuadrado**, con trazabilidad de Meta Pixel y n8n.

Sin base de datos: todo el contexto (contactId de GHL, UTMs, fbclid, event_id) viaja en la URL.

```
GHL form ──► cristributario.cl/agendar?contactId&utm_*&fbclid
              │  GET  /agendar/api/horarios ──► Encuadrado available-time-slots
              │  POST /agendar/api/reservar ──► Encuadrado bookings (redirect_url + attribution)
              │                              └► n8n  booking_initiated   (server-side, siempre)
              │  Pixel InitiateCheckout (eventID = event_id)
              ▼
         Encuadrado (pago) ──redirect──► cristributario.cl/agendamiento-exitoso?ref&event_id&utm_*&fbclid&value
              │  log server-side de TODOS los query params
              │  Pixel Schedule + Purchase (solo si CONVERSION_EVENTS_ENABLED)
              └► POST /agendar/api/notificar-conversion ──► n8n  booking_return
```

## Estructura

```
app/
  layout.tsx                         Meta Pixel base (PageView) si hay NEXT_PUBLIC_META_PIXEL_ID
  page.tsx                           / → /agendar (solo útil en el dominio de Vercel)
  agendar/
    page.tsx                         Server Component: parsea atribución
    _components/                     BookingFlow, SlotPicker, ContactForm, format (hora Chile)
    api/horarios/route.ts            GET  próximos 14 días (caché CDN 30 s)
    api/reservar/route.ts            POST crea reserva, event_id, redirect_url, booking_initiated
    api/notificar-conversion/route.ts POST reenvía retorno a n8n
  agendamiento-exitoso/
    page.tsx                         Server: loguea query params, decide conversion_confirmed
    ConfirmationClient.tsx           Pixel + fire-and-forget a n8n, dedupe por sessionStorage
lib/
  env.ts                             variables server-only (lectura perezosa)
  encuadrado/client.ts               fetch con X-API-Key, 429 backoff, log de rate limit
  encuadrado/errors.ts               código Encuadrado → mensaje en español
  encuadrado/dry-run.ts              respuestas simuladas
  conversion.ts                      isPaymentConfirmed (flag + PAYMENT_SUCCESS_PARAM)
  n8n.ts · logger.ts · meta-pixel.ts · routes.ts · tracking/params.ts
types/encuadrado.ts · types/tracking.ts
scripts/smoke-horarios.mts           GET real a Encuadrado (solo lectura)
```

### ¿Por qué todo cuelga de `/agendar`?

El Cloudflare Worker solo proxyea `cristributario.cl/agendar*` y `cristributario.cl/agendamiento-exitoso*`.
Por eso:

- Los route handlers viven en `/agendar/api/*`.
- `assetPrefix: "/agendar/_assets"` en `next.config.ts` → JS/CSS/fuentes se piden a
  `/agendar/_assets/_next/static/...` (Next 16 lo sirve nativamente, sin rewrite).

## Variables de entorno

Copia `.env.example` a `.env.local` (ignorado por git).

| Variable | Dónde se usa | Notas |
|---|---|---|
| `ENCUADRADO_API_KEY` | servidor | **Secreta.** Nunca con prefijo `NEXT_PUBLIC_`. |
| `ENCUADRADO_SERVICE_UUID` | servidor | `0dca1bcd-0abe-4618-95f4-355b7c13574a` |
| `SITE_URL` | servidor | `https://cristributario.cl` en producción. Debe coincidir **exactamente** con el dominio validado en Encuadrado, o `redirect_url_accepted` será `false`. |
| `N8N_WEBHOOK_URL` | servidor | Secreta (quien la tenga puede inyectar eventos). |
| `NEXT_PUBLIC_META_PIXEL_ID` | navegador | Se incrusta en **build**: cambiarla requiere redeploy. |
| `SERVICE_PRICE_CLP` | servidor | Entero. `0` genera un warning en logs. **Pendiente monto real.** |
| `TERMS_URL` | servidor | Placeholder `https://cristributario.cl/terminos-y-condiciones`. **Pendiente confirmar.** |
| `ENCUADRADO_DRY_RUN` | servidor | `true` = el POST de reserva **no** llama a Encuadrado. |
| `ENCUADRADO_DRY_RUN_SCENARIO` | servidor | `prepaid` · `prepaid_redirect_rejected` · `confirmed` · `booking_failed` · `rate_limited` |
| `CONVERSION_EVENTS_ENABLED` | servidor | `false` hasta confirmar qué agrega Encuadrado al redirect. |
| `PAYMENT_SUCCESS_PARAM` | servidor | Opcional, `clave=valor` (ej. `status=paid`). Si está, solo ese retorno cuenta como pago. |

Las variables sin `NEXT_PUBLIC_` se leen en runtime: en Vercel basta con redeploy (sin rebuild de código)
para que tomen efecto.

## Desarrollo local

```bash
npm install
cp .env.example .env.local      # SITE_URL=http://localhost:3000, ENCUADRADO_DRY_RUN=true
npm run dev                     # http://localhost:3000/agendar?contactId=test&utm_source=meta
```

- Con `ENCUADRADO_DRY_RUN=true` **y sin API key**, `/agendar/api/horarios` también devuelve horarios simulados.
- Con API key, los horarios son reales pero la reserva sigue simulada mientras `ENCUADRADO_DRY_RUN=true`.
- En dry-run el header `x-dry-run-scenario: <escenario>` en `POST /agendar/api/reservar` permite
  probar escenarios sin reiniciar (se ignora fuera de dry-run).
- En dry-run con redirect aceptado, `payment_url` apunta directo a `/agendamiento-exitoso?...&dry_run=1`
  para recorrer el flujo completo sin pagar.

```bash
npm run smoke:horarios   # GET real a Encuadrado con la key de .env.local (no crea nada)
npm run typecheck
npm run lint
npm run build
```

> `redirect_url_accepted` será `false` en cualquier entorno cuyo `SITE_URL` no sea el dominio validado
> en Encuadrado (localhost, previews de Vercel). Es esperado.

## Despliegue en Vercel

1. Sube el repo a GitHub e impórtalo en Vercel (Framework preset: **Next.js**, sin cambios de build).
2. **Settings → Environment Variables** (Production): todas las de la tabla. Para la primera prueba real:
   - `ENCUADRADO_DRY_RUN=false`
   - `CONVERSION_EVENTS_ENABLED=false`
   - `SITE_URL=https://cristributario.cl`
3. **Settings → Deployment Protection**: desactiva *Vercel Authentication* para Production,
   o el Worker recibirá 401.
4. Deploy. Verifica en el dominio `*.vercel.app`:
   - `GET /agendar/api/horarios` → `{"slots":[...]}`
   - `/agendar` carga con estilos (assets bajo `/agendar/_assets/...`).
5. No hardcodees el dominio `*.vercel.app` en el código: solo va en la configuración del Worker.

### Requisitos para el Cloudflare Worker

- Rutas: `cristributario.cl/agendar*` y `cristributario.cl/agendamiento-exitoso*`
  (agrega las `www.` si ese host existe).
- Reenviar **método, body, query string y headers** (incluidas cookies `_fbp`/`_fbc`).
- Conservar `CF-Connecting-IP` y `User-Agent` del usuario: `notificar-conversion` los usa para CAPI.
- No cachear `/agendar/api/*` ni `/agendamiento-exitoso*` en Cloudflare.
- Recomendado: **regla de rate limiting** en Cloudflare para `POST /agendar/api/reservar`
  (ej. 3 req/min por IP). El límite de Encuadrado es **10 POST/min para toda la API key**; un bot podría
  agotarlo y bloquear a usuarios reales.

## Contratos con n8n

Ambos eventos llegan al mismo `N8N_WEBHOOK_URL`; distínguelos por `event`.
**n8n debe ser idempotente por `event_id`** (recargas, reintentos, doble envío).

### `booking_initiated` — desde `/agendar/api/reservar`, en todos los casos exitosos

```json
{
  "event": "booking_initiated",
  "occurred_at": "2026-09-17T16:24:45.957Z",
  "event_id": "booking_1235a08c-...",
  "contactId": "ghl_abc123",
  "utms": { "utm_source": "meta", "utm_medium": "paid", "utm_campaign": "...", "utm_content": "...", "utm_term": "..." },
  "fbclid": "IwAR123",
  "booking_date_time": "2026-09-18T14:00:00Z",
  "temporal_booking_token": "tb_tok_xyz",
  "booking_token": null,
  "slot_reservation_expires_at": "2026-09-17T16:34:45+00:00",
  "redirect_url_accepted": true,
  "value": 45000,
  "currency": "CLP",
  "dry_run": false
}
```

`redirect_url_accepted: false` → el usuario no volverá a nuestra página: esa conversión solo existe aquí.

### `booking_return` — desde `/agendar/api/notificar-conversion`

```json
{
  "event": "booking_return",
  "event_id": "booking_1235a08c-...",
  "contactId": "ghl_abc123",
  "utms": { "...": "..." },
  "fbclid": "IwAR123",
  "value": 45000,
  "currency": "CLP",
  "conversion_confirmed": false,
  "raw_query_params": { "ref": "...", "event_id": "...", "...": "todo lo que agregue Encuadrado" },
  "fbp": "fb.1....", "fbc": "fb.1....",
  "client_ip": "200.1.2.3", "user_agent": "...",
  "page_url": "https://cristributario.cl/agendamiento-exitoso"
}
```

**n8n debe disparar CAPI `Purchase`/`Schedule` solo si `conversion_confirmed === true`**, con el
mismo `event_id` para deduplicar con el Pixel. `conversion_confirmed` lo calcula el servidor; el
navegador no puede forzarlo. Aun así, la URL de retorno es pública y se puede falsificar: para GHL,
considera verificar la reserva contra Encuadrado antes de marcar al contacto como pagado.

## Activar las conversiones (después de la prueba real)

1. Haz la reserva real de prueba con `CONVERSION_EVENTS_ENABLED=false`.
2. Paga y, en otra prueba, cancela el pago.
3. En Vercel Logs busca `exitoso.return_visit` → `raw_query_params` de cada caso.
4. Si Encuadrado distingue éxito de cancelación (ej. `status=paid`):
   `PAYMENT_SUCCESS_PARAM=status=paid` y `CONVERSION_EVENTS_ENABLED=true`.
   Si **solo redirige en éxito**: `CONVERSION_EVENTS_ENABLED=true` y deja `PAYMENT_SUCCESS_PARAM` vacío.
5. Redeploy.

## Logs útiles (Vercel → Logs)

| `msg` | Severidad | Significado |
|---|---|---|
| `reservar.redirect_url_rejected` | high | Encuadrado rechazó `redirect_url`. Revisa `SITE_URL` vs dominio validado. |
| `encuadrado.error` status 401/404 | critical | API key o service UUID incorrectos. |
| `encuadrado.rate_limit_low` | medium | Quedan pocas requests en la ventana. |
| `encuadrado.rate_limited_*` | warn/high | 429 recibido: reintento o falla rápida. |
| `exitoso.return_visit` | info | Todos los query params del retorno desde Encuadrado. |
| `n8n.webhook_failed` / `n8n.webhook_error` | high | n8n no recibió el evento. |
| `config.service_price_missing` | medium | `SERVICE_PRICE_CLP` sin configurar. |

## Checklist de pruebas

Probado el 2026-09-17 en local (`next build` + `next start`, Chrome headless vía Playwright,
receptor n8n simulado).

**Build y seguridad**
- [x] `next build`, `tsc --noEmit` y `eslint` sin errores.
- [x] Build con key ficticia: ni la key, ni `ENCUADRADO_API_KEY`, ni `X-API-Key` aparecen en `.next/static`.
- [x] La key no aparece en logs (verificado con fetch simulado; además el logger la redacta por si acaso).
- [x] Assets servidos bajo `/agendar/_assets/_next/...` (JS, CSS, fuentes) → 200.

**GET horarios**
- [x] Llamada real a Encuadrado con key **ficticia** → 401 real `{"error":"UNAUTHORIZED"}`, mapeado a
      mensaje en español (esto reveló la forma real del body de error, ya soportada).
- [x] **Llamada real con la API key y `service_uuid` reales** (2026-09-17, local y en Vercel): 200, 32 slots
      en 14 días, `X-RateLimit-Reset` en epoch segundos. Hallazgos: si `start` trae segundos, Encuadrado
      los propaga a los slots y omite horarios → el rango se alinea a la hora exacta. La respuesta incluye
      `available_vacancy` y `title` (no documentados).
- [x] Estados de carga, error con reintento y slots agrupados por día en hora de Chile.

**POST reserva (dry-run, sin reservas reales)**
- [x] `prepaid` → 201, `payment_url`, `event_id`, `expires_at`; `booking_initiated` en n8n con `redirect_url_accepted: true`.
- [x] `prepaid_redirect_rejected` → log `high`, flujo no bloqueado (el navegador llega a Encuadrado), `booking_initiated` con `false`.
- [x] `confirmed` (sin `temporal_booking_token`) → redirige directo a `/agendamiento-exitoso`.
- [x] `booking_failed` → `detail` mostrado tal cual bajo el campo `phone`; campo desconocido (`comuna`) → alerta general.
- [x] `rate_limited` → mensaje en español, HTTP 429.
- [x] Validación server-side: teléfono inválido, términos sin aceptar, fecha pasada, JSON inválido.
- [x] `redirect_url` con UTMs con espacios y `&` correctamente codificados.
- [x] 429 con fetch simulado: 2 reintentos con backoff y luego éxito; siempre 429 → 3 intentos y falla;
      reset lejano (50 s) → falla sin esperar; POST ante 500 → no reintenta; 503, 404, `INVALID_PAYLOAD`, timeout → mensajes correctos.

**Navegador (flujo completo en dry-run)**
- [x] Enviar vacío → errores locales por campo.
- [x] Pixel `InitiateCheckout` con `eventID = event_id`, `value` y `currency: CLP` antes de redirigir.
- [x] Retorno con flag apagado → mensaje neutro, **sin** Pixel, `booking_return` con `conversion_confirmed: false` y todos los query params.
- [x] Flag encendido + `PAYMENT_SUCCESS_PARAM=status=paid`: `status=paid` → `Schedule` y `Purchase` con el mismo eventID;
      recargar → sin duplicados; `status=cancelled` → sin Pixel, `conversion_confirmed: false`.

**Pendiente (requiere a ustedes)**
- [ ] Reserva real en horario controlado + pago → inspeccionar `exitoso.return_visit`.
- [ ] Probar cancelación de pago → ¿redirige? ¿con qué params?
- [ ] Confirmar `SERVICE_PRICE_CLP`, `TERMS_URL`, `NEXT_PUBLIC_META_PIXEL_ID`, `N8N_WEBHOOK_URL` real.
- [ ] Verificar detrás del Worker: cookies, `CF-Connecting-IP` y assets bajo `cristributario.cl/agendar/_assets`.
