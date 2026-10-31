import assert from "node:assert/strict";
import test from "node:test";
import { buildMyfansProductImportRecord } from "./myfansProductCsvImport";

test("maps Japanese product CSV columns and preserves derived reward and timestamps", () => {
  const timestamps = ["generated", "reviewed", "updated"];
  const record = buildMyfansProductImportRecord({
    "商品名": "サンプル作品",
    "商品URL": "https://myfans.jp/posts/sample",
    "アフィリンク": "https://mfco.link/r/sample",
    "引用元X URL": "https://x.com/creator/status/123",
    "creator X URL": "https://x.com/creator",
    "価格": "1200",
    "報酬率": "40",
    "プラン加入報酬": "100",
    "継続報酬率": "5",
    "人気順位": "1",
    "いいね": "200",
    "保存": "30",
    "新着": "はい",
    "素材許諾": "approved",
    "商品種別": "subscription",
  }, () => timestamps.shift() || "unexpected");

  assert.equal(record.title, "サンプル作品");
  assert.equal(record.product_url, "https://myfans.jp/posts/sample");
  assert.equal(record.affiliate_url, "https://mfco.link/r/sample");
  assert.equal(record.affiliate_url_generated_at, "generated");
  assert.equal(record.affiliate_url_expires_at, null);
  assert.equal(record.affiliate_url_source, "csv_import");
  assert.equal(record.source_x_url, "https://x.com/creator/status/123");
  assert.equal(record.creator_x_url, "https://x.com/creator");
  assert.equal(record.quote_candidate_x_url, "https://x.com/creator/status/123");
  assert.equal(record.price, 1200);
  assert.equal(record.reward_rate, 40);
  assert.equal(record.estimated_reward, 480);
  assert.equal(record.plan_signup_reward, 100);
  assert.equal(record.recurring_reward_rate, 5);
  assert.equal(record.popularity_rank, 1);
  assert.equal(record.likes_count, 200);
  assert.equal(record.saves_count, 30);
  assert.equal(record.is_new, true);
  assert.equal(record.media_permission_status, "approved");
  assert.equal(record.product_type, "subscription");
  assert.equal(record.last_reviewed_at, "reviewed");
  assert.equal(record.updated_at, "updated");
  assert.equal(timestamps.length, 0);
});

test("omits affiliate metadata without a link and applies existing defaults", () => {
  const record = buildMyfansProductImportRecord({ title: "Minimal product" }, () => "now");

  assert.equal(record.affiliate_url, "");
  assert.equal("affiliate_url_generated_at" in record, false);
  assert.equal(record.media_permission_status, "unknown");
  assert.equal(record.product_type, "single");
  assert.equal(record.status, "candidate");
  assert.equal(record.popularity_rank, null);
  assert.equal(record.is_new, false);
  assert.equal(record.last_reviewed_at, "now");
  assert.equal(record.updated_at, "now");
});
