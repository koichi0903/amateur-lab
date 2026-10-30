import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansProduct } from "./myfansAnalytics";
import { resolveTextEvidence } from "./myfansProductResolver";

const sourceStatusUrl = "https://x.com/creator/status/123";
const verifiedAt = "2026-10-29T00:00:00.000Z";

function input(text: string, products: MyfansProduct[] = []) {
  return {
    sourceStatusUrl,
    sourceAuthorHandle: "@Creator",
    text,
    products,
    evidenceSource: "author_post" as const,
    verifiedAt,
  };
}

test("does not create linkage evidence when text contains no MyFans URL", () => {
  assert.equal(resolveTextEvidence(input("作品の感想です")), null);
});

test("marks a registered product URL as exact evidence", () => {
  const productUrl = "https://myfans.jp/posts/00000000-0000-4000-8000-000000000042";
  const product = {
    id: 42,
    approved_media_id: 8,
    product_url: productUrl,
  } as MyfansProduct;

  const result = resolveTextEvidence(input(`作品はこちら ${productUrl}`, [product]));

  assert.equal(result?.product_id, 42);
  assert.equal(result?.approved_media_id, 8);
  assert.equal(result?.discovered_myfans_url, productUrl);
  assert.equal(result?.resolution_method, "exact_product_url");
  assert.equal(result?.confidence, "exact");
});

test("keeps unregistered mfco links as strong observed evidence", () => {
  const result = resolveTextEvidence(input("続き https://mfco.link/abc123"));

  assert.equal(result?.discovered_myfans_url, "https://mfco.link/abc123");
  assert.equal(result?.product_id, null);
  assert.equal(result?.resolution_method, "mfco_link_observed");
  assert.equal(result?.confidence, "strong");
});

test("keeps unregistered MyFans URLs unresolved", () => {
  const productUrl = "https://myfans.jp/posts/00000000-0000-4000-8000-000000000042";
  const result = resolveTextEvidence(input(`続き ${productUrl}`));

  assert.equal(result?.discovered_myfans_url, productUrl);
  assert.equal(result?.final_myfans_url, null);
  assert.equal(result?.product_id, null);
  assert.equal(result?.resolution_method, "unresolved");
  assert.equal(result?.confidence, "unresolved");
});
