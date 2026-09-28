import assert from "node:assert/strict";
import test from "node:test";
import { candidateSaveBlockReason } from "./myfansCandidateSave";

const candidate = (id: string, overrides: Partial<{ body: string; sourceXUrl: string; quoteXUrl: string }> = {}) => ({
  id,
  body: overrides.body ?? "候補固有の本文",
  sourceXUrl: overrides.sourceXUrl ?? "https://x.com/source/status/123",
  quoteXUrl: overrides.quoteXUrl ?? "https://x.com/source/status/123",
});

test("selectedCandidate is irrelevant: every candidate with attribution is saveable", () => {
  assert.equal(candidateSaveBlockReason(candidate("A")), null);
  assert.equal(candidateSaveBlockReason(candidate("B")), null);
  assert.equal(candidateSaveBlockReason(candidate("C")), null);
});

test("missing affiliate preparation does not block candidate log saving", () => {
  assert.equal(candidateSaveBlockReason(candidate("C", { sourceXUrl: "https://x.com/source/status/456", quoteXUrl: "https://x.com/source/status/456" })), null);
});

test("only actual attribution/content omissions block saving", () => {
  assert.match(candidateSaveBlockReason(candidate("", {})) ?? "", /候補ID/);
  assert.match(candidateSaveBlockReason(candidate("A", { body: "" })) ?? "", /本文/);
  assert.match(candidateSaveBlockReason(candidate("A", { sourceXUrl: "", quoteXUrl: "" })) ?? "", /URL/);
});
