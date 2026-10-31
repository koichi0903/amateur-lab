import assert from "node:assert/strict";
import test from "node:test";
import { parseMyfansAffiliateText } from "./myfansAffiliateTextParser";

test("parses creator, product, price, reward rate, and activity counts from copied text", () => {
  const parsed = parseMyfansAffiliateText([
    "sample_creator_name",
    "@sample_creator",
    "500フォロワー",
    "12投稿",
    "https://myfans.jp/sample_creator",
    "https://myfans.jp/posts/987?ref=dashboard",
    "【気になる新作タイトル】",
    "¥1,980",
    "報酬 50%",
    "300いいね",
    "25保存",
    "https://mfco.link/affiliate-token",
  ].join("\n"));

  assert.deepEqual(parsed.creator, {
    displayName: "sample_creator_name",
    myfansUrl: "https://myfans.jp/sample_creator",
    activityNote: "500フォロワー / 12投稿",
  });
  assert.deepEqual(parsed.product, {
    title: "【気になる新作タイトル】",
    productUrl: "https://myfans.jp/posts/987?ref=dashboard",
    affiliateUrl: "https://mfco.link/affiliate-token",
    price: 1980,
    rewardRate: 50,
    likesCount: 300,
    savesCount: 25,
    selectionReason: "myfansアフィリエイト管理画面のコピー内容から登録。フォロワー0期のX投稿実行ボードで検証対象にする候補。",
  });
});

test("accepts affiliate-only text and reports missing input or URLs clearly", () => {
  const parsed = parseMyfansAffiliateText("@creator_only\nhttps://affiliate.myfans.jp/link/123");
  assert.equal(parsed.creator.displayName, "creator_only");
  assert.equal(parsed.product.productUrl, "https://affiliate.myfans.jp/link/123");
  assert.equal(parsed.product.affiliateUrl, "https://affiliate.myfans.jp/link/123");

  assert.throws(() => parseMyfansAffiliateText("  \n "), /テキストを貼り付けてください/);
  assert.throws(() => parseMyfansAffiliateText("名前だけです"), /商品URLまたはアフィリンク/);
});
