import { parseSlot } from "@/lib/service";
import { UTM_KEYS, type AttributionContext, type Utms } from "@/types/tracking";

const MAX_PARAM_LENGTH = 500;

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function read(params: RawParams, key: string): string | undefined {
  const raw =
    params instanceof URLSearchParams ? params.get(key) : params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return clean(value);
}

/** Recorta, quita caracteres de control y limita largo. Vacío → undefined. */
export function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.replace(/[\x00-\x1f\x7f]/g, "").trim();
  return v ? v.slice(0, MAX_PARAM_LENGTH) : undefined;
}

export function cleanUtms(input: unknown): Utms {
  const utms: Utms = {};
  if (!input || typeof input !== "object") return utms;
  const obj = input as Record<string, unknown>;
  for (const key of UTM_KEYS) {
    const v = clean(obj[key]);
    if (v) utms[key] = v;
  }
  return utms;
}

/** Atribución desde los query params de /agendar (redirect de GHL). */
export function parseAttribution(params: RawParams): AttributionContext {
  const utms: Utms = {};
  for (const key of UTM_KEYS) {
    const v = read(params, key);
    if (v) utms[key] = v;
  }
  return {
    contactId: read(params, "contactId"),
    utms,
    fbclid: read(params, "fbclid"),
  };
}

/** Params de retorno en /agendamiento-exitoso (lo que armamos en redirect_url). */
export function parseReturnParams(params: RawParams) {
  const valueRaw = read(params, "value");
  const value = valueRaw !== undefined ? Number(valueRaw) : NaN;
  const attribution = parseAttribution(params);
  return {
    contactId: read(params, "ref"),
    eventId: read(params, "event_id"),
    utms: attribution.utms,
    fbclid: attribution.fbclid,
    value: Number.isFinite(value) && value >= 0 ? value : null,
    slot: parseSlot(read(params, "slot")),
  };
}

/** Normaliza query params a un objeto serializable (para logs y n8n). */
export function rawParamsToObject(
  params: RawParams,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (params instanceof URLSearchParams) {
    for (const key of new Set(params.keys())) {
      const all = params.getAll(key);
      out[key] = all.length === 1 ? all[0] : all;
    }
    return out;
  }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
