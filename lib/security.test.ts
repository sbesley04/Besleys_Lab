import { renderMarkdown } from "./markdown.ts";
import { isSafeExternalUrl, isSafeImageSource } from "./images.ts";
import { safeCallbackPath } from "./navigation.ts";
import { isValidEmail, passwordProblem } from "./validation.ts";

let failures = 0;
function ok(condition: boolean, name: string) {
  if (!condition) {
    failures += 1;
    console.log("FAIL:", name);
  }
}

const rawHtml = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
ok(!rawHtml.includes("script") && !rawHtml.includes("onerror"), "markdown strips raw executable HTML");

const unsafeLink = renderMarkdown("[bad](javascript:alert(1))");
ok(!unsafeLink.includes("javascript:") && !unsafeLink.includes("href="), "markdown rejects javascript links");

const safeLink = renderMarkdown("[good](https://example.com/notes)");
ok(safeLink.includes('href="https://example.com/notes"'), "markdown keeps secure links");
ok(safeLink.includes('rel="noopener noreferrer"'), "external markdown links are isolated");

ok(safeCallbackPath("/games?mode=1#board") === "/games?mode=1#board", "same-site callback is preserved");
for (const target of ["https://evil.test", "//evil.test", "/\\evil.test", "/%5c%5cevil.test"]) {
  ok(safeCallbackPath(target) === "/", `callback rejects ${target}`);
}

ok(isSafeImageSource("/photos/farm.jpg"), "local image path is allowed");
ok(isSafeImageSource("https://cdn.example/image.jpg"), "secure external image is allowed");
ok(!isSafeImageSource("//evil.test/image.jpg"), "protocol-relative image is rejected");
ok(!isSafeImageSource("javascript:alert(1)"), "script image URL is rejected");
ok(isSafeExternalUrl("https://github.com/example"), "secure project URL is allowed");
ok(!isSafeExternalUrl("javascript:alert(1)"), "script project URL is rejected");

ok(!isValidEmail(`${"a".repeat(250)}@x.test`), "oversized email is rejected");
ok(passwordProblem("x".repeat(73)) !== null, "password beyond bcrypt's byte limit is rejected");
ok(passwordProblem("correct horse battery staple") === null, "ordinary strong password is accepted");

console.log(failures === 0 ? "\nALL SECURITY REGRESSION TESTS PASSED" : `\n${failures} failed`);
process.exit(failures ? 1 : 0);
