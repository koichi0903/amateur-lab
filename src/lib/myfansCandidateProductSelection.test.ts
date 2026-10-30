import assert from "node:assert/strict";
import test from "node:test";
import { pickMyfansCandidateProduct } from "./myfansCandidateProductSelection.ts";

type Row = { product: { id: number; quote_candidate_x_url?: string | null } };
const row = (id: number, quoteUrl?: string): Row => ({ product: { id, quote_candidate_x_url: quoteUrl } });

function pick(input: {
  pool: Row[];
  products?: Row[];
  index?: number;
  postType: string;
  exclude?: number[];
  topicPassProductIds?: number[];
  topicReadyIds?: number[];
}) {
  return pickMyfansCandidateProduct({
    pool: input.pool,
    products: input.products ?? input.pool,
    index: input.index ?? 0,
    postType: input.postType,
    exclude: new Set(input.exclude ?? []),
    topicPassProductIds: input.topicPassProductIds ?? [],
    topicReady: (candidate) => (input.topicReadyIds ?? []).includes(candidate.product.id),
  });
}

test("ranking notes prefer an available topic-pass product that is topic-ready", () => {
  const first = row(1);
  const preferred = row(2);
  assert.equal(pick({
    pool: [first, preferred],
    postType: "ranking_note",
    topicPassProductIds: [2],
    topicReadyIds: [1, 2],
  }), preferred);
});

test("ranking notes fall back to the first topic-ready available product", () => {
  const fallback = row(1);
  const notReadyPass = row(2);
  assert.equal(pick({
    pool: [fallback, notReadyPass],
    postType: "ranking_note",
    topicPassProductIds: [2],
    topicReadyIds: [1],
  }), fallback);
});

test("authority post types prefer topic-ready products before ordinary quote fallbacks", () => {
  const quoted = row(1, "https://x.com/example/status/1");
  const topicReady = row(2);
  assert.equal(pick({
    pool: [quoted, topicReady],
    postType: "profile_cta",
    topicPassProductIds: [1],
    topicReadyIds: [2],
  }), topicReady);
});

test("discovery-interest posts prefer an available quote-backed product", () => {
  const topicProduct = row(1);
  const quoteProduct = row(2, "https://x.com/example/status/2");
  assert.equal(pick({
    pool: [topicProduct, quoteProduct],
    postType: "discovery_interest",
    topicPassProductIds: [1],
  }), quoteProduct);
});

test("product selection preserves index and global fallback order when the pool is exhausted", () => {
  const first = row(1);
  const indexed = row(2);
  const globalAvailable = row(3);
  assert.equal(pick({ pool: [first, indexed], postType: "other", exclude: [1, 2], index: 1 }), indexed);
  assert.equal(pick({
    pool: [],
    products: [first, globalAvailable],
    postType: "other",
    exclude: [1],
  }), globalAvailable);
  assert.equal(pick({ pool: [], products: [], postType: "other" }), null);
});
