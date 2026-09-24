import assert from "node:assert/strict";
import { buildVisualVideoFacts } from "./xVisualVideoFacts";
import { buildXCreativeVariants, finalNativeXVoiceGate, validateXCopyGrammar } from "./xCreativeEngine";
import type { XPostLog } from "./xPostLogs";

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
assert.deepEqual(buildXCreativeVariants(baseInput), variants);
assert.ok(videoVariants.length > 0);
assert.ok(videoVariants.every((variant) => variant.bodyText.includes("冒頭の展開が予想と少し違う。")));
assert.ok(videoVariants.every((variant) => variant.quality.lastMile.humanVoice.checks.readerAction));
assert.ok(videoVariants.every((variant) => variant.weightedLength <= 280));
assert.ok(videoVariants.every((variant) => validateXCopyGrammar(baseInput, variant.bodyText).passed));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.humanVoice.checks.readerAction));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.humanVoice.checks.concreteVisualFact));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.nativeXVoice.checks.noTemplateReuse));
assert.ok(new Set(videoVariants.map((variant) => variant.bodyText.split("\n")[1])).size >= 2);

const genericVisualFact = {
  kind: "brightness" as const,
  value: "brighter" as const,
  source: "sample_video" as const,
  confidence: 0.9,
  safePhrase: "最初より途中の方が明るく見える。",
};
const genericFactInput = {
  ...baseInput,
  key: "fixed-video-generic-fact-fixture",
  mediaManualTags: ["safe_preview" as const],
  visualFacts: { version: "visual-video-facts-v1" as const, generatedAt: "2026-01-01T00:00:00.000Z", diagnostics: [], facts: [genericVisualFact], usableFacts: [genericVisualFact] },
};
const genericFactVariants = buildXCreativeVariants(genericFactInput).filter((variant) => variant.mediaType === "sample_movie");
assert.ok(genericFactVariants.length > 0);
assert.ok(genericFactVariants.every((variant) => variant.quality.lastMile.nativeXVoice.checks.emotionalFirstLine));
assert.ok(genericFactVariants.some((variant) => variant.bodyText.split("\n")[0]?.includes("明るく見える")));
assert.deepEqual(buildXCreativeVariants(genericFactInput), buildXCreativeVariants(genericFactInput));

const videoBodies = [...new Set(videoVariants.map((variant) => variant.bodyText))];
const recentLogs = videoBodies.map((postText, index) => ({
  id: index + 1,
  post_text: postText,
  posted_at: new Date().toISOString(),
  creative_genome: {},
})) as XPostLog[];
const reuseChecked = buildXCreativeVariants({ ...baseInput, recentLogs });
assert.ok(reuseChecked.some((variant) => !variant.quality.lastMile.nativeXVoice.checks.noTemplateReuse));

const repeatedFingerprintLogs = [0, 1].map((index) => ({
  id: index + 200,
  post_text: `${index ? "別の" : "前の"}投稿です。\n続きも見ておきたい。`,
  posted_at: new Date().toISOString(),
  creative_genome: {},
})) as XPostLog[];
const fingerprintDiversified = buildXCreativeVariants({ ...baseInput, recentLogs: repeatedFingerprintLogs })
  .filter((variant) => variant.mediaType === "sample_movie");
assert.ok(fingerprintDiversified.filter((variant) => variant.quality.lastMile.nativeXVoice.checks.noTemplateReuse).length >= 10);
assert.ok(fingerprintDiversified.some((variant) => variant.bodyText.startsWith("固定女優、")));

const protectedText = "この入り方、少し気になって続きを見てしまう。\n冒頭の展開が予想と少し違う。";
const sameStructureLogs = [0, 1].map((index) => ({
  id: index + 100,
  post_text: "前の投稿です。\n次も見ておきたい。",
  posted_at: new Date().toISOString(),
  creative_genome: {},
})) as XPostLog[];
const protectedInput = { ...baseInput, recentLogs: sameStructureLogs };
assert.equal(finalNativeXVoiceGate(protectedInput, { intent: "REACH", mediaType: "sample_movie", text: protectedText }).checks.noTemplateReuse, false);
assert.equal(finalNativeXVoiceGate(baseInput, { intent: "REACH", mediaType: "sample_movie", text: `${protectedText}\n確認する価値` }).checks.noTemplateReuse, false);
assert.equal(finalNativeXVoiceGate(baseInput, { intent: "REACH", mediaType: "sample_movie", text: `${protectedText}\n刺さるなら\nタイプです` }).checks.noTemplateReuse, false);

const workBodies = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((suffix) => {
  const input = { ...baseInput, key: `fixed-video-quality-fixture-${suffix}`, title: `固定fixture作品${suffix}` };
  return buildXCreativeVariants(input).find((variant) => variant.mediaType === "sample_movie")?.bodyText;
});
assert.equal(workBodies.every(Boolean), true);
assert.ok(new Set(workBodies).size >= 5);

const imageVariants = buildXCreativeVariants({ ...baseInput, sampleMovieUrl: null, hasRightsCheckedMovie: false, visualFacts: null });
assert.ok(imageVariants.length > 0);
assert.equal(imageVariants.some((variant) => variant.mediaType === "sample_movie"), false);

const factlessInput = {
  ...baseInput,
  key: "factless-reader-action-fixture",
  sampleMovieUrl: null,
  hasRightsCheckedMovie: false,
  imageUrl: "https://pics.dmm.co.jp/digital/video/test/testpl.jpg",
  visualFacts: buildVisualVideoFacts({ imageUrl: "https://pics.dmm.co.jp/digital/video/test/testpl.jpg" }),
  radarAvailable: true,
  sourceType: "WORK" as const,
};
const factlessVariants = buildXCreativeVariants(factlessInput);
assert.ok(factlessVariants.length > 0);
assert.ok(factlessVariants.every((variant) => variant.quality.lastMile.humanVoice.checks.readerAction));
assert.ok(factlessVariants.every((variant) => variant.weightedLength <= 280));
assert.deepEqual(buildXCreativeVariants(factlessInput), factlessVariants);
assert.ok(new Set(factlessVariants.map((variant) => variant.bodyText)).size >= 4);
assert.ok(factlessVariants.every((variant) => !variant.bodyText.includes("Fact") && !variant.bodyText.includes("score")));

console.log("xCreativeEngine video quality tests passed");
