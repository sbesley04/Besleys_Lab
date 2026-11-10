// Renders scripts/resume/resume.html to public/resume.pdf (one Letter page).
// Usage: node scripts/resume/build.mjs
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// require() (not import) so a globally installed Playwright also resolves.
const { chromium } = createRequire(import.meta.url)("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "resume.html");
const out = path.join(here, "..", "..", "public", "resume.pdf");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(src).href);
  await page.pdf({ path: out, format: "Letter", preferCSSPageSize: true, printBackground: true });
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
} finally {
  await browser.close();
}
