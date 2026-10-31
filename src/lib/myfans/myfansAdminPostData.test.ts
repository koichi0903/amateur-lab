import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansPostRecord, parseMyfansPostCardPayload } from "./myfansAdminPostData";

test("admin post record retains defaults, form values, and resolved attribution", () => {
  const formData = new FormData();
  formData.set("body", "  投稿本文  ");
  formData.set("includes_pr", "false");
  formData.set("quote_candidate_id", "15");
  formData.set("creator_id", "24");
  formData.set("growth_score", "8");
  formData.set("card_payload", '{"headline":"作品紹介"}');
  const record = buildMyfansPostRecord(formData, {
    productId: 30,
    approvedMediaId: 5,
    approvedMediaName: "承認済み媒体",
    patternId: 9,
  });

  assert.equal(record.body, "投稿本文");
  assert.equal(record.post_type, "discovery");
  assert.equal(record.status, "draft");
  assert.equal(record.includes_pr, false);
  assert.equal(record.link_strategy, "no_link");
  assert.equal(record.creative_strategy, "text_only");
  assert.equal(record.objective, "impression");
  assert.equal(record.product_id, 30);
  assert.equal(record.approved_media_id, 5);
  assert.equal(record.approved_media_name, "承認済み媒体");
  assert.equal(record.pattern_id, 9);
  assert.equal(record.quote_candidate_id, 15);
  assert.equal(record.creator_id, 24);
  assert.equal(record.growth_score_snapshot, 8);
  assert.deepEqual(record.card_payload, { headline: "作品紹介" });
});

test("card payload parsing preserves invalid and empty input fallbacks", () => {
  assert.deepEqual(parseMyfansPostCardPayload(""), {});
  assert.deepEqual(parseMyfansPostCardPayload("{"), {});
  assert.deepEqual(parseMyfansPostCardPayload('{"image":"/card.png"}'), { image: "/card.png" });
});
