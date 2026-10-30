import assert from "node:assert/strict";
import test from "node:test";
import { aggregateXCreativeLearning } from "./xCreativeLearningAggregation";

test("creative learning aggregates linked views and clicks, skips unknown values, and applies the CTR prior", () => {
  const rows = aggregateXCreativeLearning([
    { post_key: "a", hook_type: "price_anomaly", link_strategy: "body_link" },
    { post_key: "b", hook_type: "price_anomaly", link_strategy: "reply_link" },
    { post_key: "c", hook_type: null, link_strategy: "body_link" },
  ], [
    { x_post_key: "a" }, { x_post_key: "a" }, { x_post_key: "b" }, { x_post_key: "c" },
  ], [
    { x_post_key: "a" }, { x_post_key: "b" },
  ]);
  const priceHook = rows.find((row) => row.dimension === "hook_type" && row.value === "price_anomaly");

  assert.deepEqual(priceHook, {
    dimension: "hook_type",
    value: "price_anomaly",
    label: "価格フック",
    posts: 2,
    xPageViews: 3,
    xFanzaClicks: 2,
    rawCtr: 66.7,
    adjustedCtr: 11.5,
    clicksPerPost: 1,
    confidence: "low",
    recommendation: "サンプル不足。まだ断定しない",
  });
  assert.equal(rows.some((row) => row.value === "unknown"), false);
  assert.deepEqual(rows.map((row) => row.adjustedCtr), [...rows.map((row) => row.adjustedCtr)].sort((a, b) => b - a));
});

test("confidence thresholds and recommendation remain tied to evidence volume", () => {
  const logs = [
    ...Array.from({ length: 6 }, (_, index) => ({ post_key: `high-${index}`, hook_type: "high" })),
    ...Array.from({ length: 3 }, (_, index) => ({ post_key: `medium-${index}`, hook_type: "medium" })),
  ];
  const views = [
    ...Array.from({ length: 120 }, (_, index) => ({ x_post_key: `high-${Math.floor(index / 20)}` })),
    ...Array.from({ length: 50 }, (_, index) => ({ x_post_key: `medium-${index % 3}` })),
  ];
  const clicks = [
    ...Array.from({ length: 12 }, (_, index) => ({ x_post_key: `high-${index % 6}` })),
    ...Array.from({ length: 3 }, (_, index) => ({ x_post_key: `medium-${index}` })),
  ];
  const rows = aggregateXCreativeLearning(logs, views, clicks);

  assert.equal(rows.find((row) => row.dimension === "hook_type" && row.value === "high")?.confidence, "high");
  assert.equal(rows.find((row) => row.dimension === "hook_type" && row.value === "medium")?.confidence, "medium");
  assert.equal(rows.find((row) => row.dimension === "hook_type" && row.value === "high")?.recommendation, "勝ち寄り。配分を少し増やす");
});
