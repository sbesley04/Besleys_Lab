import { marked, Renderer } from "marked";

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function safeUrl(value: string, image = false): string | null {
  const href = value.trim();
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return null;

  if (href.startsWith("#")) return image ? null : href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (!image && (href.startsWith("./") || href.startsWith("../"))) return href;

  try {
    const parsed = new URL(href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return href;
    if (!image && parsed.protocol === "mailto:") return href;
  } catch {
    return null;
  }

  return null;
}

const renderer = new Renderer();

// Markdown is intentionally not an HTML escape hatch. This removes script,
// iframe, event-handler and other raw HTML tokens before they reach the page.
renderer.html = () => "";

renderer.link = (href, title, text) => {
  const url = safeUrl(href);
  if (!url) return text;
  const external = /^https?:\/\//i.test(url);
  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
  const relAttribute = external ? ' rel="noopener noreferrer"' : "";
  return `<a href="${escapeAttribute(url)}"${titleAttribute}${relAttribute}>${text}</a>`;
};

renderer.image = (href, title, text) => {
  const url = safeUrl(href, true);
  if (!url) return "";
  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
  return `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(text)}"${titleAttribute} loading="lazy" decoding="async">`;
};

/** Render the site's small Markdown dialect without permitting executable HTML. */
export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false, renderer }) as string;
}
