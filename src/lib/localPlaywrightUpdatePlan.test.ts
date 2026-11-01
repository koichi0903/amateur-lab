import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalPlaywrightUpdateOptions,
  localPlaywrightUpdateFailureMessage,
  localPlaywrightUpdateStatusMessage,
  selectLocalPlaywrightUpdateWorks,
  summarizeLocalPlaywrightUpdate,
} from "./localPlaywrightUpdatePlan.ts";

test("local Playwright update options keep product lookup, limits, and exclusions", () => {
  assert.deepEqual(buildLocalPlaywrightUpdateOptions({
    productId: "  scute1583 ",
    limit: 50,
    excludeProductIds: ["old-1", "invalid/id", "old-2"],
  }), {
    productId: "scute1583",
    limit: 1,
    excludeProductIds: ["old-1", "old-2"],
    fetchLimit: 1,
  });
  assert.deepEqual(buildLocalPlaywrightUpdateOptions({ limit: 500 }), {
    productId: undefined,
    limit: 100,
    excludeProductIds: [],
    fetchLimit: 100,
  });
  assert.equal(buildLocalPlaywrightUpdateOptions({ limit: Number.NaN }).limit, 10);
});

test("local Playwright update candidates keep source order after exclusions", () => {
  const options = buildLocalPlaywrightUpdateOptions({ limit: 2, excludeProductIds: ["old-1"] });
  const candidates = ["old-1", "old-2", "old-3", "old-4"].map((product_id) => ({
    product_id,
    url: `https://example.test/${product_id}`,
    list_price: null,
  }));
  assert.deepEqual(selectLocalPlaywrightUpdateWorks(candidates, options).map((work) => work.product_id), ["old-2", "old-3"]);
});

test("local Playwright update summary preserves status counts and messages", () => {
  assert.equal(localPlaywrightUpdateStatusMessage("unavailable"), "FANZA側でページまたは価格を確認できませんでした。");
  assert.equal(localPlaywrightUpdateStatusMessage("sample_movie_missing"), "サンプル動画を確認できませんでした。");
  assert.equal(localPlaywrightUpdateStatusMessage("unchanged"), undefined);
  assert.equal(localPlaywrightUpdateFailureMessage(new Error("network")), "network");
  assert.equal(localPlaywrightUpdateFailureMessage(null), "Playwright更新に失敗しました。");
  assert.deepEqual(summarizeLocalPlaywrightUpdate([
    { productId: "a", success: true, status: "updated" },
    { productId: "b", success: true, status: "unchanged" },
    { productId: "c", success: true, status: "unavailable_deferred" },
    { productId: "d", success: false, status: "failed" },
  ]), {
    success: false,
    succeeded: 1,
    unavailable: 1,
    failed: 1,
    results: [
      { productId: "a", success: true, status: "updated" },
      { productId: "b", success: true, status: "unchanged" },
      { productId: "c", success: true, status: "unavailable_deferred" },
      { productId: "d", success: false, status: "failed" },
    ],
    message: "ローカルPlaywright更新: 更新1件 / 利用不可1件 / 失敗1件",
  });
});
