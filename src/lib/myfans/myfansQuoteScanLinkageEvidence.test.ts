import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansQuoteScanCandidate } from "../myfansQuoteScoring";
import { buildQuoteCandidateLinkageEvidence, type ExactProductResolution } from "./myfansQuoteScanLinkageEvidence";
import type { QuoteScanProduct } from "./myfansQuoteScanTypes";

const finalMyfansUrl = "https://myfans.jp/posts/00000000-0000-4000-8000-000000000042";

function candidate(overrides: Partial<MyfansQuoteScanCandidate> = {}): MyfansQuoteScanCandidate {
  return {
    xPostUrl: "https://x.com/creator/status/123",
    sourceXHandle: "creator",
    ...overrides,
  };
}

function input(overrides: Partial<Parameters<typeof buildQuoteCandidateLinkageEvidence>[0]> = {}): Parameters<typeof buildQuoteCandidateLinkageEvidence>[0] {
  return {
    approvedMediaId: 7,
    approvedProduct: null,
    candidate: candidate(),
    creatorId: 31,
    finalMyfansUrl,
    itemProduct: { approved_media_id: 9 },
    itemProductId: 42,
    itemProductResolution: { product: null, status: "exact", method: "existing_canonical_url", missing: [] },
    resolverEvidence: [],
    resolverProducts: [],
    savedCandidateId: 99,
    sourceXHandle: "creator",
    ...overrides,
  };
}

test("builds exact linkage from the selected resolved product and matching resolver evidence", () => {
  const result = buildQuoteCandidateLinkageEvidence(input({
    candidate: candidate({ myfansLinkSource: "own_reply", ownReplyStatusUrl: "https://x.com/creator/status/456" }),
    resolverEvidence: [{ finalMyfansUrl, observedMfcoUrl: "https://mfco.link/r/abc?source=x" }],
  }));

  assert.equal(result?.approved_media_id, 7);
  assert.equal(result?.quote_candidate_id, 99);
  assert.equal(result?.source_status_url, "https://x.com/creator/status/456");
  assert.equal(result?.discovered_myfans_url, "https://mfco.link/r/abc");
  assert.equal(result?.final_myfans_url, finalMyfansUrl);
  assert.equal(result?.product_id, 42);
  assert.equal(result?.resolution_method, "exact_product_url");
  assert.equal(result?.evidence_source, "author_reply");
  assert.equal(result?.metadata?.myfans_post_uuid, "00000000-0000-4000-8000-000000000042");
});

test("does not infer a linkage when a final URL was found but product resolution is not exact", () => {
  const result = buildQuoteCandidateLinkageEvidence(input({
    itemProductResolution: { product: null, status: "ambiguous", method: "ambiguous", missing: [] } satisfies ExactProductResolution,
    candidate: candidate({ text: "https://mfco.link/r/ignored" }),
  }));

  assert.equal(result, null);
});

test("uses text evidence when the scan did not resolve a final product URL", () => {
  const approvedProduct = { id: 8, creator_id: 31, approved_media_id: 8, title: "sample", creator_x_url: null } satisfies QuoteScanProduct;
  const result = buildQuoteCandidateLinkageEvidence(input({
    approvedMediaId: null,
    approvedProduct,
    candidate: candidate({ myfansLinkSource: "own_reply", ownReplyStatusUrl: "https://x.com/creator/status/456", text: "続き https://mfco.link/r/abc" }),
    finalMyfansUrl: "",
    itemProductResolution: { product: null, status: "not_registered", method: "missing", missing: [] },
  }));

  assert.equal(result?.approved_media_id, 8);
  assert.equal(result?.source_status_url, "https://x.com/creator/status/456");
  assert.equal(result?.source_author_handle, "creator");
  assert.equal(result?.discovered_myfans_url, "https://mfco.link/r/abc");
  assert.equal(result?.evidence_source, "author_reply");
  assert.equal(result?.confidence, "strong");
});

test("keeps unlinked candidates without MyFans text as null evidence", () => {
  const result = buildQuoteCandidateLinkageEvidence(input({
    candidate: candidate({ text: "作品の感想です" }),
    finalMyfansUrl: "",
    itemProductResolution: { product: null, status: "not_registered", method: "missing", missing: [] },
  }));

  assert.equal(result, null);
});
