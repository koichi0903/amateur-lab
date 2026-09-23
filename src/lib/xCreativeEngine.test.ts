import assert from "node:assert/strict";
import { buildVisualVideoFacts } from "./xVisualVideoFacts";
import { buildXCreativeVariants, validateXCopyGrammar } from "./xCreativeEngine";

const movieUrl = "https://cc3001.dmm.co.jp/litevideo/freepv/test/test_dmb_w.mp4";
const baseInput = {
  key: "fixed-video-quality-fixture",
  title: "固定fixture作品",
  url: "https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=test/",
  category: "discovery",
  actress: "固定女優",
  genre: "固定ジャンル",
  currentPrice: 980,
  previousPrice: 1980,
  discountRate: 50,
  reviewAverage: 4.7,
  reviewCount: 120,
  ranking: 42,
  score: 80,
  discoveryScore: 80,
  buyTimingScore: 80,
  isNinetyDayLow: false,
  sampleMovieUrl: movieUrl,
  imageUrl: "https://pics.dmm.co.jp/digital/video/test/testpl.jpg",
  hasRightsCheckedMovie: true,
  mediaManualTags: ["scene_surprise" as const],
  mediaQuality: "strong" as const,
  sourceType: "WORK" as const,
  visualFacts: buildVisualVideoFacts({ sampleMovieUrl: movieUrl, manualTags: ["scene_surprise"] }),
};

const oldRepresentative = "冒頭の展開が予想と少し違う。\nサンプルの方が強いかどうか、そこまで見たい。";
assert.equal(/見る|見て|迷|決め|止ま|流|拾|比べ|買|見送|気にな|刺さ|引っかか|伝わ/.test(oldRepresentative), false);

const variants = buildXCreativeVariants(baseInput);
const videoVariants = variants.filter((variant) => variant.mediaType === "sample_movie");
assert.ok(videoVariants.length > 0);
assert.ok(videoVariants.every((variant) => variant.bodyText.includes("冒頭の展開が予想と少し違う。")));
assert.ok(videoVariants.every((variant) => /見る|見て|迷|決め|止ま|流|拾|比べ|買|見送|気にな|刺さ|引っかか|伝わ/.test(variant.bodyText)));
assert.ok(videoVariants.every((variant) => variant.weightedLength <= 280));
assert.ok(videoVariants.every((variant) => validateXCopyGrammar(baseInput, variant.bodyText).passed));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.humanVoice.checks.readerAction));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.humanVoice.checks.concreteVisualFact));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.nativeXVoice.checks.noTemplateReuse));
assert.ok(new Set(videoVariants.map((variant) => variant.bodyText.split("\n")[1])).size >= 2);

const imageVariants = buildXCreativeVariants({ ...baseInput, sampleMovieUrl: null, hasRightsCheckedMovie: false, visualFacts: null });
assert.ok(imageVariants.length > 0);
assert.equal(imageVariants.some((variant) => variant.mediaType === "sample_movie"), false);

console.log("xCreativeEngine video quality tests passed");
