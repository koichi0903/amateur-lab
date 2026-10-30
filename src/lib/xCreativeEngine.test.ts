import assert from "node:assert/strict";
import { buildVisualVideoFacts } from "./xVisualVideoFacts";
import { buildXCreativeVariants, finalNativeXVoiceGate, validateXCopyGrammar, voiceArchetype } from "./xCreativeEngine";
import { buildDecisionFacts } from "./domain/decisionFacts";
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

const voiceArchetypeCases = [
  ["confession", "spontaneous_reaction"], ["missed", "spontaneous_reaction"],
  ["surprise", "surprise_mismatch"], ["contrast", "surprise_mismatch"],
  ["social_proof", "social_proof_light"], ["follow_up", "conversational"], ["question", "conversational"],
  ["curation", "quiet_recommendation"], ["anti_obvious", "quiet_recommendation"],
  ["hot_take", "changed_mind"], ["comparison", "dry_observation"], ["pattern_break", "dry_observation"],
  ["empathy", "actress_fit"],
] as const;
for (const [direction, expected] of voiceArchetypeCases) {
  assert.equal(voiceArchetype(direction, 0), expected);
}
assert.equal(voiceArchetype("curiosity", 0), "hidden_find");
assert.equal(voiceArchetype("curiosity", 1), "price_reason");
assert.equal(voiceArchetype("curiosity", 2), "spontaneous_reaction");

const oldRepresentative = "冒頭の展開が予想と少し違う。\nサンプルの方が強いかどうか、そこまで見たい。";
assert.equal(/見る|見て|迷|決め|止ま|流|拾|比べ|買|見送|気にな|刺さ|引っかか|伝わ/.test(oldRepresentative), false);

const variants = buildXCreativeVariants(baseInput);
const videoVariants = variants.filter((variant) => variant.mediaType === "sample_movie");
assert.deepEqual(buildXCreativeVariants(baseInput), variants);
assert.equal(variants[0]?.hookAlternatives[0]?.direction, "surprise");
const genericOpeningFixture = {
  ...baseInput,
  key: "fixed-generic-opening-order-fixture",
  title: "余白のある街",
  actress: null,
  genre: null,
  currentPrice: null,
  previousPrice: null,
  discountRate: 0,
  reviewAverage: null,
  reviewCount: 0,
  ranking: null,
  score: 0,
  discoveryScore: 0,
  buyTimingScore: 0,
  sampleMovieUrl: null,
  imageUrl: null,
  hasRightsCheckedMovie: false,
  mediaManualTags: [],
  mediaQuality: "weak" as const,
  sourceType: "WORK" as const,
  visualFacts: null,
};
const genericOpeningAlternatives = buildXCreativeVariants(genericOpeningFixture)[0]?.hookAlternatives ?? [];
assert.deepEqual(genericOpeningAlternatives.map(({ direction, opening, score }) => ({ direction, opening, score })), [
  { direction: "question", opening: "「余白のある街」、まだ見てない人は多そうです。", score: 80 },
  { direction: "missed", opening: "「余白のある街」、最初は通りすぎてました。", score: 78 },
  { direction: "curiosity", opening: "「余白のある街」、数字より先に雰囲気で気になります。", score: 76 },
  { direction: "surprise", opening: "「余白のある街」、思ったより静かな顔をしてます。", score: 76 },
  { direction: "hot_take", opening: "売れているかより、引っかかり方の方が気になります。", score: 73 },
  { direction: "empathy", opening: "セール欄を流し見してる人ほど、「余白のある街」は一回止まっていいと思います。", score: 72 },
]);
const decisionOpeningCases = [
  {
    key: "decision-opening-record-low",
    facts: buildDecisionFacts({ currentPrice: 500, recordedLowestPrice: 500, discountRate: 50, isOnSale: true, ranking: 9999, reviewAverage: 4.7, reviewCount: 120 }),
    direction: "curiosity",
    opening: "発掘LABの記録上の最安値。価格履歴を先に見たいです。",
  },
  {
    key: "decision-opening-high-discount",
    facts: buildDecisionFacts({ currentPrice: 1500, recordedLowestPrice: 1000, discountRate: 50, isOnSale: true, ranking: 9999, reviewAverage: 4.7, reviewCount: 120 }),
    direction: "contrast",
    opening: "50%OFFでも、発掘LABの記録上の最安値ではありません。",
  },
  {
    key: "decision-opening-hidden-value",
    facts: buildDecisionFacts({ currentPrice: 1500, recordedLowestPrice: null, discountRate: 50, isOnSale: true, ranking: 9999, reviewAverage: 4.7, reviewCount: 120 }),
    direction: "comparison",
    opening: "ランキング外。評価4.7 / レビュー120件 / 現在1,500円 / 50%OFF。ランキングだけでは見落としやすいです。",
  },
];
for (const decisionCase of decisionOpeningCases) {
  const opening = buildXCreativeVariants({ ...baseInput, key: decisionCase.key, decisionFacts: decisionCase.facts })[0]?.hookAlternatives[0];
  assert.equal(opening?.direction, decisionCase.direction);
  assert.equal(opening?.opening, decisionCase.opening);
  assert.equal(opening?.score, 112);
}
const visualMismatchOpening = buildXCreativeVariants({
  ...baseInput,
  key: "fixed-video-mismatch-opening-fixture",
  mediaManualTags: ["visual_mismatch" as const],
  visualFacts: buildVisualVideoFacts({ sampleMovieUrl: movieUrl, manualTags: ["visual_mismatch"] }),
})[0]?.hookAlternatives[0];
assert.equal(visualMismatchOpening?.direction, "contrast");
const lastMileSourceCases = [
  { sourceType: "PRICE_EVENT" as const, expected: "半額だけでなく、評価まで高いのが少し気になります。" },
  { sourceType: "MARKET" as const, expected: "ランキングだけ見ていると、今日の当たりを外しそうです。" },
  { sourceType: "COMPARISON" as const, expected: "同じ50%OFFでも、サンプルを見るなら差があります。" },
  { sourceType: "JUDGMENT" as const, expected: "50%OFFだけど、これは今日は見送っていいかもしれません。" },
];
for (const routeCase of lastMileSourceCases) {
  const routed = buildXCreativeVariants({
    ...baseInput,
    key: `last-mile-route-${routeCase.sourceType}`,
    sourceType: routeCase.sourceType,
    sampleMovieUrl: null,
    hasRightsCheckedMovie: false,
    visualFacts: null,
    mediaManualTags: [],
  })[0];
  assert.ok(routed?.bodyText.includes(routeCase.expected), `${routeCase.sourceType} route should retain its opening`);
}
assert.ok(videoVariants.length > 0);
const openingFactPhrases = ["冒頭の展開が予想と少し違う", "再生してすぐ、想像していた流れと変わった", "冒頭の入り方が、思っていた流れと少し違う"];
assert.ok(videoVariants.every((variant) => openingFactPhrases.some((phrase) => variant.bodyText.includes(phrase))));
const priceEventVideoVariants = buildXCreativeVariants({
  ...baseInput,
  key: "price-event-video-route-fixture",
  sourceType: "PRICE_EVENT",
  imageUrl: null,
}).filter((variant) => variant.mediaType === "sample_movie");
assert.ok(priceEventVideoVariants.length > 0);
assert.ok(priceEventVideoVariants.every((variant) => openingFactPhrases.some((phrase) => variant.bodyText.includes(phrase))));
assert.ok(new Set(videoVariants.flatMap((variant) => openingFactPhrases.filter((phrase) => variant.bodyText.includes(phrase)))).size >= 2);
assert.ok(videoVariants.filter((variant) => variant.intent === "AUTHORITY").every((variant) => variant.quality.dimensions.replyability >= 58));
assert.ok(videoVariants.every((variant) => variant.quality.lastMile.humanVoice.checks.readerAction));
assert.ok(videoVariants.every((variant) => variant.weightedLength <= 280));
assert.ok(videoVariants.every((variant) => validateXCopyGrammar(baseInput, variant.bodyText).passed));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.humanVoice.checks.readerAction));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.humanVoice.checks.concreteVisualFact));
assert.ok(videoVariants.some((variant) => variant.quality.lastMile.nativeXVoice.checks.noTemplateReuse));
assert.ok(new Set(videoVariants.map((variant) => variant.bodyText.split("\n")[1])).size >= 2);
assert.ok(videoVariants.some((variant) => variant.bodyText.split("\n").some((line) => line.includes("評価4.7") && /少し気になった|サンプルを見たい|決めず/.test(line))));
assert.deepEqual(buildXCreativeVariants(baseInput), buildXCreativeVariants(baseInput));

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

const decisionFactVideoVariants = buildXCreativeVariants({
  ...baseInput,
  key: "fixed-video-decision-facts-fixture",
  decisionFacts: buildDecisionFacts({
    currentPrice: 500,
    recordedLowestPrice: 500,
    discountRate: 50,
    isOnSale: true,
    ranking: 9999,
    reviewAverage: 4.7,
    reviewCount: 120,
    recordedLowestAt: "2026-09-23T12:00:00.000Z",
    coverageStart: "2026-07-08T00:00:00.000Z",
    coverageEnd: "2026-09-24T00:00:00.000Z",
    priceSeries: { displayName: "7日間", period: "7日間" },
  }),
}).filter((variant) => variant.mediaType === "sample_movie");
assert.ok(decisionFactVideoVariants.length > 0);
assert.ok(decisionFactVideoVariants.some((variant) => variant.quality.passed || variant.quality.recommendation === "revise"));
assert.ok(decisionFactVideoVariants.every((variant) => !variant.bodyText.includes("発掘LABの記録上の最安値。発掘LABの記録上の最安値")));

const untaggedVideoVariants = buildXCreativeVariants({
  ...baseInput,
  key: "fixed-video-untagged-fixture",
  mediaManualTags: [],
  visualFacts: buildVisualVideoFacts({ sampleMovieUrl: movieUrl }),
}).filter((variant) => variant.mediaType === "sample_movie");
assert.ok(untaggedVideoVariants.length > 0);
assert.ok(untaggedVideoVariants.some((variant) => variant.quality.lastMile.nativeXVoice.checks.timelineNative));
assert.ok(untaggedVideoVariants.some((variant) => variant.quality.passed || variant.quality.recommendation === "revise"));

const videoBodies = [...new Set(videoVariants.map((variant) => variant.bodyText))];
const recentLogs = videoBodies.map((postText, index) => ({
  id: index + 1,
  post_text: postText,
  posted_at: new Date().toISOString(),
  creative_genome: {},
})) as XPostLog[];
const reuseChecked = buildXCreativeVariants({ ...baseInput, recentLogs });
assert.ok(reuseChecked.some((variant) => !variant.quality.lastMile.nativeXVoice.checks.noTemplateReuse));
const historicalVideoTemplate = buildXCreativeVariants({
  ...baseInput,
  recentLogs: [{ id: 900, post_text: "固定女優、冒頭の展開が予想と少し違う。", posted_at: new Date().toISOString(), creative_genome: {} }] as XPostLog[],
}).filter((variant) => variant.mediaType === "sample_movie");
assert.ok(historicalVideoTemplate.some((variant) => variant.quality.lastMile.nativeXVoice.checks.noTemplateReuse));

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

const imageDecisionFactVariants = buildXCreativeVariants({
  ...baseInput,
  key: "fixed-image-decision-facts-fixture",
  sampleMovieUrl: null,
  hasRightsCheckedMovie: false,
  visualFacts: buildVisualVideoFacts({ imageUrl: baseInput.imageUrl }),
  decisionFacts: buildDecisionFacts({
    currentPrice: 150,
    recordedLowestPrice: 150,
    discountRate: 50,
    isOnSale: true,
    ranking: 185,
    reviewAverage: 4.8,
    reviewCount: 65,
    recordedLowestAt: "2026-10-05T20:00:00.000Z",
    coverageStart: "2026-07-15T00:00:00.000Z",
    coverageEnd: "2026-10-05T20:00:00.000Z",
    priceSeries: { displayName: "HD版ストリーミング", period: "7日間" },
  }),
}).filter((variant) => variant.mediaType === "existing_link_image");
assert.ok(imageDecisionFactVariants.length > 0);
assert.ok(imageDecisionFactVariants.some((variant) => variant.quality.passed || variant.quality.recommendation === "revise"));
assert.ok(imageDecisionFactVariants.every((variant) => !variant.bodyText.includes("unsupported_scene")));

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
