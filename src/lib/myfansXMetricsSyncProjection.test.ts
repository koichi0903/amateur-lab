import assert from "node:assert/strict";
import test from "node:test";
import { projectMyfansXPostMetrics, type XMetricPost } from "./myfansXMetricsSyncProjection.ts";

test("prefers organic metrics and keeps the existing source priority", () => {
  const metric: XMetricPost = {
    id: "post-1",
    organic_metrics: {
      impression_count: 10,
      like_count: 11,
      retweet_count: 12,
      reply_count: 13,
      url_link_clicks: 14,
    },
    non_public_metrics: {
      impression_count: 20,
      url_link_clicks: 24,
    },
    public_metrics: {
      impression_count: 30,
      like_count: 31,
      retweet_count: 32,
      reply_count: 33,
    },
  };

  assert.deepEqual(projectMyfansXPostMetrics(metric), {
    impressions: 10,
    likes_count: 11,
    reposts_count: 12,
    replies_count: 13,
    clicks: 14,
  });
});

test("falls back through available metrics and preserves zero as a valid value", () => {
  const metric: XMetricPost = {
    id: "post-2",
    organic_metrics: {
      impression_count: Number.NaN,
      like_count: 0,
      retweet_count: Number.POSITIVE_INFINITY,
      url_link_clicks: Number.NaN,
    },
    non_public_metrics: {
      impression_count: 22,
      url_link_clicks: 24,
    },
    public_metrics: {
      impression_count: 30,
      like_count: 31,
      retweet_count: 32,
      reply_count: 33,
    },
  };

  assert.deepEqual(projectMyfansXPostMetrics(metric), {
    impressions: 22,
    likes_count: 0,
    reposts_count: 32,
    replies_count: 33,
    clicks: 24,
  });
});

test("defaults missing or non-finite metrics to zero", () => {
  assert.deepEqual(projectMyfansXPostMetrics({ id: "post-3" }), {
    impressions: 0,
    likes_count: 0,
    reposts_count: 0,
    replies_count: 0,
    clicks: 0,
  });
});
