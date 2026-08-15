const CALLBACK_ORIGIN = "https://besleys-lab.invalid";

/** Reduce a callback target to a same-site path, or return the fallback. */
export function safeCallbackPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || /[\\\u0000-\u001f\u007f]|%5c/i.test(value)) return fallback;
  try {
    const parsed = new URL(value, CALLBACK_ORIGIN);
    if (parsed.origin !== CALLBACK_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
