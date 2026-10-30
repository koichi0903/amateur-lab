import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansPatternLearningValues, buildMyfansPostExecutionRecord } from "./myfansPostExecutionData";

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test("post execution record maps each supported mode and rejects unknown modes", () => {
  const posted = buildMyfansPostExecutionRecord("posted", new FormData());
  assert.deepEqual(Object.keys(posted ?? {}).sort(), ["posted_at", "status", "updated_at"]);
  assert.equal(posted && "status" in posted ? posted.status : null, "posted");

  const url = buildMyfansPostExecutionRecord("url", formData({ x_post_url: "https://x.com/account/status/123" }));
  assert.equal(url && "status" in url ? url.status : null, "posted");
  assert.equal(url && "x_post_url" in url ? url.x_post_url : null, "https://x.com/account/status/123");

  const metrics = buildMyfansPostExecutionRecord("metrics", formData({
    impressions: "100",
    likes_count: "4",
    reposts_count: "2",
    replies_count: "1",
    clicks: "15",
  }));
  assert.equal(metrics && "impressions" in metrics ? metrics.impressions : null, 100);
  assert.equal(metrics && "likes_count" in metrics ? metrics.likes_count : null, 4);
  assert.equal(buildMyfansPostExecutionRecord("unsupported", new FormData()), null);
});

test("pattern learning values preserve the existing additive metrics and posterior formula", () => {
  const values = buildMyfansPatternLearningValues({
    approved_media_id: 2,
    pattern_id: 4,
    creator_id: null,
    product_id: 8,
    quote_candidate_id: null,
    impressions: 100,
    likes_count: 4,
    reposts_count: 2,
    replies_count: 1,
    clicks: 15,
  }, {
    id: 10,
    impressions: 10,
    engagements: 3,
    clicks: 2,
    posts_count: 2,
    posterior_weight: 1.5,
  }, 99, { lastObservedAt: "2026-10-29T00:00:00.000Z", updatedAt: "2026-10-29T00:00:01.000Z" });

  assert.equal(values.impressions, 110);
  assert.equal(values.engagements, 10);
  assert.equal(values.clicks, 17);
  assert.equal(values.posts_count, 3);
  assert.equal(values.posterior_weight, 3);
  assert.equal(values.last_observed_at, "2026-10-29T00:00:00.000Z");
  assert.equal(values.updated_at, "2026-10-29T00:00:01.000Z");
  assert.deepEqual(values.metadata, { feedback_source: "myfans_x_posts_metrics", post_id: 99 });
});
