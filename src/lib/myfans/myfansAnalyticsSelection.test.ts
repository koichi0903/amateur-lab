import assert from "node:assert/strict";
import test from "node:test";
import { selectMyfansAnalyticsRows } from "./myfansAnalyticsSelection.ts";

const mediaA = { id: 1, media_name: "媒体A", affiliate_media_id: "ma" };

test("filters operational rows to the selected account and keeps unassigned candidates", () => {
  const result = selectMyfansAnalyticsRows({
    allProducts: [
      { id: 10, approved_media_id: 1 },
      { id: 20, approved_media_id: 2 },
      { id: 30, approved_media_name: "媒体A" },
      { id: 40, affiliate_media_id: "ma" },
    ],
    allPosts: [
      { product_id: 10, approved_media_id: 1 },
      { product_id: 20, approved_media_id: 1 },
      { product_id: 30, approved_media_id: 2 },
      { product_id: null, approved_media_id: 1 },
    ],
    allConversions: [
      { product_id: 10, approved_media_id: 1 },
      { product_id: 20, approved_media_id: 1 },
      { product_id: 10, approved_media_id: 2 },
    ],
    clickRows: [{ approved_media_id: 1 }, { approved_media_id: 2 }],
    dailyRows: [{ approved_media_id: 1 }, { approved_media_id: 2 }],
    xAccountMetrics: [{ approved_media_id: 1 }, { approved_media_id: 2 }],
    quoteCandidates: [{ approved_media_id: 1 }, { approved_media_id: null }, { approved_media_id: 2 }],
    productLinkageEvidence: [
      { approved_media_id: 1, diagnostic_mode: false },
      { approved_media_id: 1, diagnostic_mode: true },
      { approved_media_id: 2, diagnostic_mode: false },
    ],
    dailyPlans: [{ approved_media_id: 1 }, { approved_media_id: 2 }],
    selectedMedia: mediaA,
  });

  assert.deepEqual(result.products.map((row) => row.id), [10, 30, 40]);
  assert.deepEqual(result.posts.map((row) => row.product_id), [10, null]);
  assert.deepEqual(result.conversions.map((row) => row.product_id), [10]);
  assert.equal(result.clicks30d, 1);
  assert.equal(result.daily.length, 1);
  assert.equal(result.xAccountMetrics.length, 1);
  assert.deepEqual(result.quoteCandidates.map((row) => row.approved_media_id), [1, null]);
  assert.equal(result.productLinkageEvidence.length, 1);
  assert.equal(result.diagnosticProductLinkageEvidence.length, 1);
  assert.equal(result.dailyPlans.length, 1);
});

test("keeps the shared Market Winner supply pool while filtering account history", () => {
  const marketWinner = { id: 5, media_name: "共有", affiliate_media_id: "shared" };
  const result = selectMyfansAnalyticsRows({
    allProducts: [{ id: 10, approved_media_id: 1 }, { id: 20, approved_media_id: 2 }],
    allPosts: [{ product_id: 10, approved_media_id: 1 }, { product_id: 20, approved_media_id: 2 }],
    allConversions: [],
    clickRows: [],
    dailyRows: [],
    xAccountMetrics: [],
    quoteCandidates: [{ approved_media_id: 1 }, { approved_media_id: 2 }, { approved_media_id: null }],
    productLinkageEvidence: [
      { approved_media_id: 1, diagnostic_mode: false },
      { approved_media_id: 5, diagnostic_mode: true },
    ],
    dailyPlans: [{ approved_media_id: 1 }, { approved_media_id: 5 }],
    selectedMedia: marketWinner,
  });

  assert.deepEqual(result.products.map((row) => row.id), [10, 20]);
  assert.deepEqual(result.posts, []);
  assert.deepEqual(result.quoteCandidates.map((row) => row.approved_media_id), [1, 2, null]);
  assert.deepEqual(result.productLinkageEvidence, []);
  assert.deepEqual(result.diagnosticProductLinkageEvidence.map((row) => row.approved_media_id), [5]);
  assert.deepEqual(result.dailyPlans.map((row) => row.approved_media_id), [5]);
});
