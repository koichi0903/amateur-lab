import assert from "node:assert/strict";
import test from "node:test";
import { buildLegacyXPostLogFallback } from "./xPostLogFallback.ts";

const row = {
  account_handle: "hakkutsu_lab",
  post_key: "post-key",
  work_id: 42,
  category: "score",
  title: "作品",
  post_text: "投稿文",
  post_date: "2026-10-31",
  posted_at: "2026-10-31T00:00:00.000Z",
  post_intent: "work_link",
  scheduled_slot: "night",
  planned_at: null,
  evaluation_due_at: "2026-11-01T00:00:00.000Z",
  creative_variant_id: "variant-1",
  hook_type: "price_anomaly",
  image_strategy: "original_work_image",
  link_strategy: "reply_link",
  cta_strategy: "price_cta",
  x_post_id: null,
  opportunity_id: 5,
  media_asset_id: 7,
  creative_genome: { topic: "作品" },
};

const legacyRow = {
  post_key: row.post_key,
  work_id: row.work_id,
  category: row.category,
  title: row.title,
  post_text: row.post_text,
  post_date: row.post_date,
  posted_at: row.posted_at,
};

test("builds the legacy payload only from columns available in the old schema", () => {
  assert.deepEqual(buildLegacyXPostLogFallback({ code: "PGRST204" }, null, row), legacyRow);
});

test("recognizes each schema-cache error for a newer X post-log column", () => {
  for (const column of ["creative_variant_id", "account_handle", "post_intent", "x_post_id"]) {
    assert.deepEqual(
      buildLegacyXPostLogFallback({ message: `Could not find the '${column}' column` }, null, row),
      legacyRow,
    );
  }
});

test("does not discard an X post id or retry unrelated errors", () => {
  assert.equal(buildLegacyXPostLogFallback({ code: "PGRST204" }, "x-123", row), null);
  assert.equal(buildLegacyXPostLogFallback({ code: "23505", message: "duplicate key" }, null, row), null);
  assert.equal(buildLegacyXPostLogFallback(null, null, row), null);
});
