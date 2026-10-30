import assert from "node:assert/strict";
import test from "node:test";
import { buildObservedProductRecords } from "./myfansObservedPostImport";

test("new observed post gets a minimal unlinked product record and legacy fallback", () => {
  const result = buildObservedProductRecords({
    payload: { genre: " daily ", creatorName: " creator ", publishedAt: "2026-10-29" },
    approvedMediaId: 42,
    existing: null,
    productUrl: "https://myfans.jp/posts/123",
    title: "observed title",
    now: "2026-10-29T00:00:00.000Z",
    price: 800,
    likesCount: 17,
  });

  assert.equal(result.record.creator_id, null);
  assert.equal(result.record.affiliate_url, "");
  assert.equal(result.record.approved_media_id, 42);
  assert.equal(result.record.title, "observed title");
  assert.equal(result.record.product_url, "https://myfans.jp/posts/123");
  assert.equal(result.record.price, 800);
  assert.equal(result.record.likes_count, 17);
  assert.deepEqual(result.sourceMetadata, {
    observed_url: "https://myfans.jp/posts/123",
    observed_title: "observed title",
    observed_creator_name: "creator",
    observed_genre: "daily",
    observed_likes_count: 17,
    observed_published_at: "2026-10-29",
    observed_price: 800,
    creator_linkage: "not_inferred_from_post_url",
    affiliate_linkage: "not_observed",
  });
  assert.equal("ingest_source" in result.legacyRecord, false);
  assert.equal("source_observed_at" in result.legacyRecord, false);
  assert.equal("source_metadata" in result.legacyRecord, false);
  assert.equal(result.legacyRecord.price, 800);
});

test("refresh preserves populated price and likes while adding observed supply metadata", () => {
  const result = buildObservedProductRecords({
    payload: {},
    approvedMediaId: null,
    existing: { id: 9, affiliate_url: "https://affiliate.example/item", price: 1200, likes_count: 28 },
    productUrl: "https://myfans.jp/posts/123",
    title: "updated title",
    now: "2026-10-29T00:00:00.000Z",
    price: 900,
    likesCount: 35,
  });

  assert.deepEqual(result.record, {
    title: "updated title",
    product_url: "https://myfans.jp/posts/123",
    ingest_source: "chrome_observed_myfans_post",
    source_observed_at: "2026-10-29T00:00:00.000Z",
    source_metadata: {
      observed_url: "https://myfans.jp/posts/123",
      observed_title: "updated title",
      observed_creator_name: "",
      observed_genre: "",
      observed_likes_count: 35,
      observed_published_at: "",
      observed_price: 900,
      creator_linkage: "not_inferred_from_post_url",
      affiliate_linkage: "not_observed",
    },
    updated_at: "2026-10-29T00:00:00.000Z",
  });
  assert.equal("price" in result.record, false);
  assert.equal("likes_count" in result.record, false);
  assert.equal("affiliate_url" in result.record, false);
});

test("refresh fills only missing price and likes", () => {
  const result = buildObservedProductRecords({
    payload: {},
    approvedMediaId: null,
    existing: { id: 9, affiliate_url: null, price: 0, likes_count: 0 },
    productUrl: "https://myfans.jp/posts/123",
    title: "updated title",
    now: "2026-10-29T00:00:00.000Z",
    price: 900,
    likesCount: 35,
  });

  assert.equal(result.record.price, 900);
  assert.equal(result.record.likes_count, 35);
});
