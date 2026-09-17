type FbqParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    fbq?: (
      command: "init" | "track" | "trackCustom",
      eventOrId: string,
      params?: FbqParams,
      options?: { eventID?: string },
    ) => void;
  }
}

export type MetaStandardEvent = "InitiateCheckout" | "Schedule" | "Purchase";

/** Dispara un evento estándar con eventID para deduplicar contra CAPI. No lanza nunca. */
export function trackMetaEvent(
  event: MetaStandardEvent,
  params: FbqParams,
  eventId: string,
): boolean {
  try {
    if (typeof window === "undefined" || typeof window.fbq !== "function") {
      return false;
    }
    window.fbq("track", event, params, { eventID: eventId });
    return true;
  } catch {
    return false;
  }
}

/** Lee una cookie del navegador (para _fbp / _fbc). */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
