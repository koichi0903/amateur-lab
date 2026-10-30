import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanAffiliateUrl,
  cleanDiagnosticStatusUrl,
  cleanMyfansUrl,
  cleanText,
  cleanValidationStatus,
  cleanXMediaPermalink,
  cleanXProfileUrl,
  cleanXStatusUrl,
  numberValue,
} from "./myfansCompanionInput";

test("normalizes untrusted text and numeric values", () => {
  assert.equal(cleanText(" １２３ "), "123");
  assert.equal(numberValue("報酬 ¥1,200"), 1200);
  assert.equal(numberValue("-12"), 0);
  assert.equal(numberValue("invalid"), 0);
});

test("allows only supported affiliate and MyFans link hosts", () => {
  assert.equal(cleanAffiliateUrl(" https://mfco.link/r/abc_123?source=x "), "https://mfco.link/r/abc_123?source=x");
  assert.equal(cleanAffiliateUrl("https://example.com/r/abc"), "");
  assert.equal(cleanMyfansUrl("https://www.MyFans.jp/posts/123?utm_source=x#top"), "https://www.MyFans.jp/posts/123");
  assert.equal(cleanMyfansUrl("https://example.com/posts/123"), "");
});

test("canonicalizes valid X profile, status, and media URLs while rejecting invalid profiles", () => {
  assert.equal(cleanXProfileUrl("https://twitter.com/Creator_12/"), "https://x.com/Creator_12");
  assert.equal(cleanXProfileUrl("https://x.com/home"), "");
  assert.equal(cleanXProfileUrl("https://x.com/creator-12"), "");
  assert.equal(cleanXProfileUrl("https://x.com/creator_12/status/34"), "");
  assert.equal(cleanXStatusUrl("https://twitter.com/Creator_12/status/123?ref=home"), "https://x.com/Creator_12/status/123");
  assert.equal(cleanDiagnosticStatusUrl("https://twitter.com/Creator_12/status/123"), "https://x.com/Creator_12/status/123");
  assert.equal(cleanDiagnosticStatusUrl("https://x.com/Creator_12/status/123?ref=home"), "");
  assert.equal(cleanDiagnosticStatusUrl("https://x.com/creator-name/status/123"), "");
  assert.equal(cleanXMediaPermalink("https://twitter.com/Creator_12/status/123/video/2?tag=1"), "https://x.com/Creator_12/status/123/video/2");
  assert.equal(cleanXMediaPermalink("https://x.com/Creator_12/status/123/video/0"), "");
});

test("constrains validation status to a short safe token", () => {
  assert.equal(cleanValidationStatus(" OK/unsafe value "), "OKunsafevalue");
  assert.equal(cleanValidationStatus("a".repeat(100)).length, 80);
});
