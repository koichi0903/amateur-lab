import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionFacts } from "../domain/decisionFacts";
import { buildXCreativeVariants } from "../xCreativeEngine";
import { buildVisualVideoFacts, visualFactScores } from "../xVisualVideoFacts";
import { selectRankedDailyTopPicks } from "./xGrowthDailySelection";
import type { XGrowthOpportunity } from "../xGrowthOS";

const generatedImageVariant = buildXCreativeVariants({
  key: "daily-selection-regression",
  title: "固定fixture作品",
  url: "https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=fixed/",
  category: "discovery",
  actress: "固定女優",
  genre: "固定ジャンル",
  currentPrice: 150,
  previousPrice: 200,
  discountRate: 25,
  reviewAverage: 4.8,
  reviewCount: 65,
  ranking: null,
  score: 80,
  discoveryScore: 80,
  buyTimingScore: 80,
  isNinetyDayLow: false,
  sampleMovieUrl: null,
  imageUrl: "https://pics.dmm.co.jp/digital/video/fixed/fixedpl.jpg",
  hasRightsCheckedMovie: false,
  visualFacts: buildVisualVideoFacts({ imageUrl: "https://pics.dmm.co.jp/digital/video/fixed/fixedpl.jpg" }),
  sourceType: "WORK",
  decisionFacts: buildDecisionFacts({
    currentPrice: 150,
    recordedLowestPrice: 150,
    discountRate: 25,
    isOnSale: true,
    ranking: null,
    reviewAverage: 4.8,
    reviewCount: 65,
  }),
}).find((variant) => variant.intent === "REACH" && variant.mediaType === "existing_link_image");

assert.ok(generatedImageVariant, "fixture must produce an image REACH variant");
const imageVariant = generatedImageVariant;
if (!imageVariant) throw new Error("fixture must produce an image REACH variant");

function opportunity(index: number, imageUrl: string): XGrowthOpportunity {
  const workId = index + 1;
  const variant = {
    ...imageVariant,
    id: `fixture-${workId}`,
    bodyText: `作品${workId}の画像で雰囲気を確かめたい。`,
    url: `https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=fixed${workId}/`,
    creativeGenome: {
      ...imageVariant.creativeGenome,
      topic: `作品${workId}`,
      hook: `画像観察${workId}`,
    },
  };
  return {
    key: `fixture-${workId}`,
    workId,
    productId: `product-${workId}`,
    title: `作品${workId}`,
    actress: `女優${workId}`,
    genre: `ジャンル${workId}`,
    maker: null,
    category: "discovery_gap",
    sourceType: "WORK",
    label: "発掘",
    reason: "selection regression fixture",
    selectionReason: "selection regression fixture",
    postText: variant.bodyText,
    weightedLength: variant.weightedLength,
    currentPrice: 150,
    previousPrice: 200,
    discountRate: 25,
    reviewAverage: 4.8,
    reviewCount: 65,
    score: 80,
    discoveryScore: 80,
    buyTimingScore: 80,
    ranking: null,
    checkedAt: "2026-10-28T00:00:00.000Z",
    funnelScore: 80,
    xPageViews: 0,
    xFanzaClicks: 0,
    xCtr: 0,
    seriesName: null,
    seriesPeriod: null,
    chartPoints: [],
    seriesMinimumPrice: 150,
    seriesMaximumPrice: 200,
    seriesObservationCount: 2,
    seriesStartedAt: null,
    seriesLowestAt: null,
    newRecordedLowToday: false,
    isNinetyDayLow: false,
    cooldownDays: 0,
    creativeKind: "discovery",
    hookScore: { axes: {}, bestHook: {} } as never,
    hookType: imageVariant.hookType,
    creativeVariantId: variant.id,
    creativeVariants: [variant],
    imageStrategy: variant.imageStrategy,
    linkStrategy: variant.linkStrategy,
    ctaStrategy: variant.ctaStrategy,
    replyText: null,
    postIntent: "work_link",
    recommendedSlot: "night",
    plannedAt: "2026-10-28T12:00:00.000Z",
    growthGoal: "profile_visit",
    sampleMovieUrl: null,
    imageUrl,
    saleEndAt: null,
    decisionFacts: buildDecisionFacts({
      currentPrice: 150,
      recordedLowestPrice: 150,
      discountRate: 25,
      isOnSale: true,
      ranking: null,
      reviewAverage: 4.8,
      reviewCount: 65,
    }),
    creativeAngle: "HIDDEN_GEM",
    sourceEvidence: [],
    eventType: "hidden_gem",
    intent: "REACH",
    reachScore: 20 + index,
    followScore: 70,
    authorityScore: 60,
    revenueScore: 50,
    mediaType: "existing_link_image",
    mediaUsage: "allowed",
    canNativeVideo: false,
    mediaAsset: null,
    visualFacts: buildVisualVideoFacts({ imageUrl }),
    visualScoring: visualFactScores(buildVisualVideoFacts({ imageUrl })),
    recommendedMediaUrl: null,
    mediaDecision: "fixture image",
    rankingHistory: { status: "accumulating", previousRanking: null, rankingDelta: null, observations: 0 },
    freshness: { opportunityScore: 50, saleScore: 0, priceChangeScore: 0, rankingVelocityScore: 0, total: 50, status: "fresh", reasons: [] },
    evidence: [],
    creativeGenome: variant.creativeGenome,
  } as unknown as XGrowthOpportunity;
}

test("daily ranked selection returns nine unique eligible image picks in score order", () => {
  const items = Array.from({ length: 12 }, (_, index) => opportunity(
    index,
    // The second work intentionally shares an image and must not duplicate the first pick.
    index === 1 ? "https://pics.dmm.co.jp/digital/video/fixed/1pl.jpg" : `https://pics.dmm.co.jp/digital/video/fixed/${index + 1}pl.jpg`,
  ));

  const result = selectRankedDailyTopPicks(items, [], new Set(), new Set());

  assert.equal(result.picks.length, 9);
  assert.deepEqual(result.picks.map((pick) => pick.pickOrder), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(new Set(result.picks.map((pick) => pick.workId)).size, 9);
  assert.equal(new Set(result.picks.map((pick) => pick.recommendedMediaUrl)).size, 9);
  assert.equal(result.rankingDiagnostics.rankedPoolTotalUniqueWorks, 11);
  assert.equal(result.rankingDiagnostics.duplicateBreakdown.lostUniqueWorks, 1);
  assert.deepEqual(
    result.picks.map((pick) => pick.workId),
    result.rankingDiagnostics.topRankedCandidates.slice(0, 9).map((candidate) => candidate.workId),
  );
  assert.ok(result.picks.every((pick, index, picks) => index === 0 || picks[index - 1].dailyScore >= pick.dailyScore));
  assert.ok(result.picks.every((pick) => pick.mediaType === "existing_link_image" && !/https?:\/\//.test(pick.postText)));
  assert.equal(result.rankingDiagnostics.mediaQuotaChosen, "0 video / 9 image");
});
