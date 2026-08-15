const MAX_URL_LENGTH = 2_048;
const LOCAL_ORIGIN = "https://besleys-lab.invalid";

export function isExternalImage(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

export function isSafeImageSource(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const source = value.trim();
  if (!source || source.length > MAX_URL_LENGTH || /[\u0000-\u001f\u007f\\]/.test(source)) return false;

  try {
    const url = new URL(source, LOCAL_ORIGIN);
    if (source.startsWith("/")) return url.origin === LOCAL_ORIGIN && !source.startsWith("//");
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const source = value.trim();
  if (!source || source.length > MAX_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(source)) return false;
  try {
    const url = new URL(source);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
