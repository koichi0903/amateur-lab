import assert from "node:assert/strict";
import test from "node:test";
import { buildVisualVerificationQueueRows } from "./myfansVisualVerificationQueueRows.ts";

test("deduplicates trimmed source URLs while preserving order and the first candidate", () => {
  const result = buildVisualVerificationQueueRows([
    { id: 1, creator_id: 10, media_permalink: " https://example.com/media/1 ", x_post_url: "https://x.com/post/1", media_type: "video" },
    { id: 2, creator_id: 20, media_permalink: "https://example.com/media/1", x_post_url: null, media_type: "image" },
    { id: 3, creator_id: 30, media_permalink: null, x_post_url: "https://x.com/post/3", media_type: null },
  ], "v1");

  assert.deepEqual(result, {
    totalSources: 2,
    rows: [
      { quote_candidate_id: 1, source_url: "https://example.com/media/1", creator_id: 10, media_type: "video", analyzer_version: "v1" },
      { quote_candidate_id: 3, source_url: "https://x.com/post/3", creator_id: 30, media_type: "none", analyzer_version: "v1" },
    ],
  });
});

test("keeps the existing 42-source queue cap", () => {
  const candidates = Array.from({ length: 43 }, (_, index) => ({
    id: index + 1,
    creator_id: null,
    media_permalink: `https://example.com/media/${index + 1}`,
    x_post_url: null,
    media_type: "video",
  }));

  const result = buildVisualVerificationQueueRows(candidates, "v2");

  assert.equal(result.totalSources, 42);
  assert.equal(result.rows.length, 42);
  assert.equal(result.rows[41].quote_candidate_id, 42);
});
