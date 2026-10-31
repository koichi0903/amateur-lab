import assert from "node:assert/strict";
import test from "node:test";
import {
  applyObservedMfcoLink,
  countDiagnosticReplyMyfansLinks,
  isExistingNonDiagnosticEvidence,
  prepareDiagnosticStatusScan,
  selectDiagnosticStatusReplies,
  shouldIgnoreDiagnosticLookupError,
  shouldIgnoreDiagnosticUpsertError,
  summarizeDiagnosticStatusReplies,
} from "./myfansDiagnosticStatusScanRules.ts";

test("normalizes the source identity and sanitizes or derives the diagnostic run id", () => {
  assert.deepEqual(prepareDiagnosticStatusScan({
    sourceStatusUrl: "https://x.com/Example/status/123",
    sourceXHandle: "@example",
    diagnosticRunId: "batch!-17",
  }, 1000), {
    sourceStatusUrl: "https://x.com/Example/status/123",
    sourceXHandle: "example",
    runId: "batch-17",
    isValid: true,
  });
  assert.equal(prepareDiagnosticStatusScan({
    sourceStatusUrl: "https://x.com/Example/status/123",
    sourceXHandle: "other",
  }, 1000).isValid, false);
});

test("takes only the first 40 matching author replies and excludes the source post", () => {
  const candidates = [
    { xPostUrl: "https://twitter.com/Example/status/1", sourceXHandle: "example", isReply: true, authorHandle: "@Example", myfansUrls: ["one"] },
    { xPostUrl: "https://x.com/other/status/2", sourceXHandle: "other", isReply: true, authorHandle: "other" },
    { xPostUrl: "https://x.com/Example/status/123", sourceXHandle: "example", isReply: true, authorHandle: "example" },
    ...Array.from({ length: 38 }, (_, index) => ({ xPostUrl: `https://x.com/example/status/${index + 10}`, sourceXHandle: "example", isReply: false, authorHandle: "example" })),
    { xPostUrl: "https://x.com/example/status/999", sourceXHandle: "example", isReply: true, authorHandle: "example" },
  ];
  const selected = selectDiagnosticStatusReplies(candidates, "https://x.com/Example/status/123", "example");
  assert.deepEqual(selected.map((candidate) => candidate.xPostUrl), ["https://x.com/Example/status/1"]);
  assert.deepEqual(summarizeDiagnosticStatusReplies(selected), [{
    statusUrl: "https://x.com/Example/status/1",
    authorHandle: "@Example",
    isReply: true,
    myfansUrls: ["one"],
  }]);
  assert.equal(countDiagnosticReplyMyfansLinks(selected), 1);
});

test("promotes only observed unresolved evidence and protects non-diagnostic records", () => {
  const evidence = {
    source_status_url: "https://x.com/example/status/1",
    source_author_handle: "example",
    discovered_myfans_url: "https://mfco.link/x",
    product_id: 10,
    final_myfans_url: "https://myfans.jp/item/x",
    resolution_method: "unresolved" as const,
    confidence: "unresolved" as const,
    evidence_source: "author_reply" as const,
    verified_at: "now",
  };
  assert.equal(applyObservedMfcoLink(evidence, true).confidence, "strong");
  assert.equal(evidence.resolution_method, "mfco_link_observed");
  assert.equal(evidence.product_id, null);
  assert.equal(evidence.final_myfans_url, null);
  assert.equal(applyObservedMfcoLink({ ...evidence, confidence: "exact", resolution_method: "exact_product_url" }, true).confidence, "exact");
  assert.equal(isExistingNonDiagnosticEvidence({ diagnostic_mode: false }), true);
  assert.equal(isExistingNonDiagnosticEvidence({ diagnostic_mode: true }), false);
});

test("tolerates only the diagnostic schema-compatibility lookup and upsert errors", () => {
  assert.equal(shouldIgnoreDiagnosticLookupError("Could not find diagnostic_mode in schema cache"), true);
  assert.equal(shouldIgnoreDiagnosticLookupError("permission denied"), false);
  assert.equal(shouldIgnoreDiagnosticUpsertError("relation does not exist"), true);
  assert.equal(shouldIgnoreDiagnosticUpsertError("diagnostic_mode missing"), false);
});
