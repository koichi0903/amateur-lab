import assert from "node:assert/strict";
import test from "node:test";
import { MAX_URLS_PER_INSPECTION_REQUEST, normalizeActressUrl, validateGoogleUrlInspectionUrls } from "./googleUrlInspectionInput";

test("accepts a canonical HTTPS actress URL", () => {
  assert.equal(normalizeActressUrl("https://hakkutsu-lab.com/actress/AIKA"), "https://hakkutsu-lab.com/actress/AIKA");
});

test("rejects non-string, overlong, and non-actress inputs", () => {
  assert.equal(normalizeActressUrl(null), null);
  assert.equal(normalizeActressUrl("x".repeat(2049)), null);
  assert.equal(normalizeActressUrl("https://hakkutsu-lab.com/work/AIKA"), null);
  assert.equal(normalizeActressUrl("https://hakkutsu-lab.com/actress/"), null);
  assert.equal(normalizeActressUrl("https://hakkutsu-lab.com/actress/AIKA/related"), null);
});

test("rejects non-canonical origins and URL decorations", () => {
  for (const url of [
    "http://hakkutsu-lab.com/actress/AIKA",
    "https://hakkutsu-lab.com.attacker.invalid/actress/AIKA",
    "https://user@hakkutsu-lab.com/actress/AIKA",
    "https://hakkutsu-lab.com:8443/actress/AIKA",
    "https://hakkutsu-lab.com/actress/AIKA?from=admin",
    "https://hakkutsu-lab.com/actress/AIKA#fragment",
  ]) assert.equal(normalizeActressUrl(url), null, url);
});

test("validates URL batches while preserving count, normalization, and duplicate errors", () => {
  assert.deepEqual(validateGoogleUrlInspectionUrls([]), {
    ok: false,
    error: "urlsには1〜635件を指定してください。",
  });
  assert.deepEqual(validateGoogleUrlInspectionUrls(Array.from({ length: MAX_URLS_PER_INSPECTION_REQUEST + 1 }, (_, index) => `https://hakkutsu-lab.com/actress/${index}`)), {
    ok: false,
    error: "urlsには1〜635件を指定してください。",
  });
  assert.deepEqual(validateGoogleUrlInspectionUrls(["https://example.invalid/actress/AIKA"]), {
    ok: false,
    error: "https://hakkutsu-lab.com/actress/{slug} のURLだけを指定できます。",
  });
  assert.deepEqual(validateGoogleUrlInspectionUrls([
    "https://hakkutsu-lab.com/actress/AIKA",
    "https://hakkutsu-lab.com/actress/AIKA",
  ]), { ok: false, error: "URLの重複は指定できません。" });
  assert.deepEqual(validateGoogleUrlInspectionUrls(["https://hakkutsu-lab.com/actress/AIKA"]), {
    ok: true,
    urls: ["https://hakkutsu-lab.com/actress/AIKA"],
  });
});
