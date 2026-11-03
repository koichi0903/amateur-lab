import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansProductFormRecord } from "./myfansProductFormRecord";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

test("builds a manual product record with normalized numbers and explicit media metadata", () => {
  const timestamps = ["reviewed", "updated"];
  const { record, selectionScore } = buildMyfansProductFormRecord(form({
    creator_id: "42",
    title: "Manual sample",
    product_url: "https://myfans.jp/posts/manual",
    affiliate_url: "https://mfco.link/r/manual",
    affiliate_url_generated_at: "generated",
    affiliate_url_expires_at: "2026-12-01T00:00:00.000Z",
    affiliate_url_source: "operator",
    source_x_url: "https://x.com/creator/status/1",
    price: "1,200",
    reward_rate: "40%",
    plan_signup_reward: "100",
    recurring_reward_rate: "5.5",
    popularity_rank: "3",
    likes_count: "200",
    saves_count: "30",
    is_new: "true",
    approved_media_name: "approved",
    approved_media_url: "https://example.com/media",
  }), 71, () => timestamps.shift() || "unexpected");

  assert.equal(record.creator_id, 42);
  assert.equal(record.approved_media_id, 71);
  assert.equal(record.title, "Manual sample");
  assert.equal(record.affiliate_url_generated_at, "generated");
  assert.equal(record.affiliate_url_expires_at, "2026-12-01T00:00:00.000Z");
  assert.equal(record.affiliate_url_source, "operator");
  assert.equal(record.quote_candidate_x_url, "https://x.com/creator/status/1");
  assert.equal(record.price, 1200);
  assert.equal(record.reward_rate, 40);
  assert.equal(record.estimated_reward, 480);
  assert.equal(record.plan_signup_reward, 100);
  assert.equal(record.recurring_reward_rate, 5.5);
  assert.equal(record.popularity_rank, 3);
  assert.equal(record.likes_count, 200);
  assert.equal(record.saves_count, 30);
  assert.equal(record.is_new, true);
  assert.equal(record.selection_score, selectionScore);
  assert.equal(record.last_reviewed_at, "reviewed");
  assert.equal(record.updated_at, "updated");
  assert.equal(timestamps.length, 0);
});

test("keeps manual product defaults when optional values are omitted", () => {
  const { record } = buildMyfansProductFormRecord(form({ title: "Minimal product" }), null, () => "now");

  assert.equal(record.creator_id, null);
  assert.equal(record.approved_media_id, null);
  assert.equal(record.affiliate_url, "");
  assert.equal("affiliate_url_generated_at" in record, false);
  assert.equal(record.quote_candidate_x_url, "");
  assert.equal(record.media_permission_status, "unknown");
  assert.equal(record.product_type, "single");
  assert.equal(record.status, "candidate");
  assert.equal(record.last_reviewed_at, "now");
  assert.equal(record.updated_at, "now");
});
