import { decisionFactProofLine } from "@/lib/domain/decisionFacts";
import { getXWeightedLength } from "@/lib/xText";
import type { XCreativeInput, XHookAxis, XHookScore, XHookType, XVideoManualTag } from "./xCreativeTypes";

const HOOK_ORDER: XHookType[] = ["ranking_anomaly", "price_anomaly", "buy_timing", "discovery_anomaly", "rating_anomaly", "review_proof"];
const STRONG_FACT_LIMIT = 2;
const VIDEO_TAG_PRIORITY: XVideoManualTag[] = ["too_explicit_for_reach", "weak_visual", "first_seconds_strong", "visual_mismatch", "scene_surprise", "actress_fit", "safe_preview"];
export const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
export const yen = (value: number | null) => value ? `${value.toLocaleString("ja-JP")}円` : "価格未取得";
export const pct = (value: number) => `${Math.max(0, Math.round(value))}%`;

function axis(type: XHookType, score: number, label: string, evidence: string, metrics: Record<string, number | null>): XHookAxis {
  return { type, score: clamp(score), label, evidence, metrics };
}

export function calculateHookScore(input: XCreativeInput): XHookScore {
  const priceDrop = calculatePriceDrop(input);
  const priceScore = calculatePriceScore(input, priceDrop);
  const scores = {
    price: priceScore,
    rating: calculateRatingScore(input),
    review: calculateReviewScore(input.reviewCount),
    ranking: calculateRankingScore(input.ranking),
    discovery: input.discoveryScore ?? Math.max(0, Math.min(100, Math.round(input.score))),
    buyTiming: input.buyTimingScore ?? Math.max(priceScore, input.discountRate >= 30 ? 68 : 0),
  };
  const axes = buildHookAxes(input, priceDrop, scores);
  const bestHook = [...HOOK_ORDER].map((type) => axes[type]).sort((a, b) => b.score - a.score || HOOK_ORDER.indexOf(a.type) - HOOK_ORDER.indexOf(b.type))[0];
  return { axes, bestHook };
}

function calculatePriceDrop(input: XCreativeInput) {
  return input.previousPrice && input.currentPrice && input.previousPrice > input.currentPrice
    ? Math.round((1 - input.currentPrice / input.previousPrice) * 100)
    : input.discountRate;
}

function calculatePriceScore(input: XCreativeInput, priceDrop: number) {
  const discountScore = priceDrop >= 70 ? 96 : priceDrop >= 50 ? 88 : priceDrop >= 30 ? 72 : priceDrop >= 15 ? 54 : 18;
  return Math.max(input.isNinetyDayLow ? 92 : 0, discountScore);
}

function calculateRatingScore(input: XCreativeInput) {
  if (!input.reviewAverage) return 0;
  return input.reviewAverage >= 4.8 ? 94 : input.reviewAverage >= 4.6 ? 82 : input.reviewAverage >= 4.3 ? 66 : 34;
}

function calculateReviewScore(reviewCount: number) {
  return reviewCount >= 200 ? 96 : reviewCount >= 100 ? 86 : reviewCount >= 50 ? 72 : reviewCount >= 20 ? 56 : reviewCount >= 8 ? 38 : 0;
}

function calculateRankingScore(ranking: number | null) {
  if (!ranking) return 0;
  return ranking <= 10 ? 92 : ranking <= 30 ? 84 : ranking <= 80 ? 70 : ranking <= 180 ? 58 : 42;
}

function buildHookAxes(
  input: XCreativeInput,
  priceDrop: number,
  scores: { price: number; rating: number; review: number; ranking: number; discovery: number; buyTiming: number },
): Record<XHookType, XHookAxis> {
  return {
    price_anomaly: priceAxis(input, priceDrop, scores.price),
    rating_anomaly: ratingAxis(input, scores.rating),
    ranking_anomaly: rankingAxis(input, scores.ranking),
    review_proof: reviewAxis(input, scores.review),
    discovery_anomaly: discoveryAxis(input, scores.discovery),
    buy_timing: buyTimingAxis(input, scores.buyTiming),
  };
}

function priceAxis(input: XCreativeInput, priceDrop: number, score: number) {
  const evidence = input.isNinetyDayLow
    ? `過去90日最安級、${pct(priceDrop)}OFF`
    : `${yen(input.previousPrice)}から${yen(input.currentPrice)}、${pct(priceDrop)}OFF`;
  return axis("price_anomaly", score, "価格異常", evidence, {
    currentPrice: input.currentPrice,
    previousPrice: input.previousPrice,
    discountRate: priceDrop,
  });
}

function ratingAxis(input: XCreativeInput, score: number) {
  return axis("rating_anomaly", score, "評価異常", `評価${input.reviewAverage?.toFixed(2) ?? "-"}、レビュー${input.reviewCount}件`, {
    reviewAverage: input.reviewAverage,
    reviewCount: input.reviewCount,
  });
}

function rankingAxis(input: XCreativeInput, score: number) {
  return axis("ranking_anomaly", score, "ランキング異常", `ランキング${input.ranking ?? "-"}位、評価${input.reviewAverage?.toFixed(2) ?? "-"}、レビュー${input.reviewCount}件`, {
    ranking: input.ranking,
    reviewAverage: input.reviewAverage,
    reviewCount: input.reviewCount,
  });
}

function reviewAxis(input: XCreativeInput, score: number) {
  return axis("review_proof", score, "レビュー証明", `レビュー${input.reviewCount}件、評価${input.reviewAverage?.toFixed(2) ?? "-"}`, {
    reviewAverage: input.reviewAverage,
    reviewCount: input.reviewCount,
  });
}

function discoveryAxis(input: XCreativeInput, score: number) {
  return axis("discovery_anomaly", score, "発掘指数", `発掘指数${score}`, {
    discoveryScore: score,
    ranking: input.ranking,
  });
}

function buyTimingAxis(input: XCreativeInput, score: number) {
  return axis("buy_timing", score, "買い時", `買い時${score}、${pct(input.discountRate)}OFF`, {
    buyTimingScore: score,
    discountRate: input.discountRate,
  });
}

export function evidenceLines(input: XCreativeInput) {
  const decisionProof = input.decisionFacts ? decisionFactProofLine(input.decisionFacts) : "";
  return [
    decisionProof,
    input.ranking ? `ランキング${input.ranking}位` : "",
    input.reviewAverage ? `評価${input.reviewAverage.toFixed(1)} / レビュー${input.reviewCount}件` : "",
    input.isNinetyDayLow ? `過去90日最安級 / ${pct(input.discountRate)}OFF` : input.discountRate >= 15 ? `${pct(input.discountRate)}OFF` : "",
    input.currentPrice ? `現在${yen(input.currentPrice)}` : "",
  ].filter(Boolean);
}

export function strongestFacts(input: XCreativeInput) {
  const decisionProof = input.decisionFacts ? decisionFactProofLine(input.decisionFacts) : "";
  const trend = rankingTrendLine(input);
  const facts = [
    decisionProof,
    trend ? `${trend}` : "",
    input.reviewAverage && input.reviewAverage >= 4.7 ? `評価${input.reviewAverage.toFixed(1)}` : "",
    input.ranking && !trend && input.ranking <= 80 ? `ランキング${input.ranking}位` : "",
    input.isNinetyDayLow ? `過去90日最安級` : "",
    input.discountRate >= 30 ? `${pct(input.discountRate)}OFF` : "",
    input.reviewCount >= 20 ? `レビュー${input.reviewCount}件` : "",
  ];
  if (input.sourceType === "MONEY" && input.currentPrice) facts.push(`現在${yen(input.currentPrice)}`);
  return facts.filter(Boolean).slice(0, STRONG_FACT_LIMIT);
}

export function primaryActress(input: XCreativeInput) {
  return input.actress?.split(/[,、/]/)[0]?.trim() || null;
}

export function hasRankingTrend(input: XCreativeInput) {
  return Boolean(input.rankingHistoryCount && input.rankingHistoryCount >= 2 && input.previousRanking && input.ranking && input.previousRanking > input.ranking);
}

function rankingTrendLine(input: XCreativeInput) {
  return hasRankingTrend(input) ? `${input.previousRanking}位→${input.ranking}位` : null;
}

function naturalTitle(title: string, remainingWeight: number) {
  const clean = title.replace(/[.…]+$/g, "").trim();
  if (!clean) return null;
  return getXWeightedLength(`「${clean}」`) <= remainingWeight ? `「${clean}」` : null;
}

export function formatText(lines: string[], title: string) {
  let working = [...lines];
  const titleIndex = working.findIndex((line) => line === "__TITLE__");
  if (titleIndex >= 0) {
    const withoutTitle = working.filter((_, index) => index !== titleIndex).join("\n");
    const titleLine = naturalTitle(title, 280 - getXWeightedLength(withoutTitle) - 2);
    working = titleLine ? working.map((line) => line === "__TITLE__" ? titleLine : line) : working.filter((line) => line !== "__TITLE__");
  }
  let text = working.join("\n");
  while (getXWeightedLength(text) > 280 && working.length > 2) {
    const removable = working.findIndex((line) => line.includes("確認") || line.includes("気になる") || line.includes("候補"));
    working.splice(removable >= 0 ? removable : working.length - 2, 1);
    text = working.join("\n");
  }
  return text;
}

export function hookSubject(input: XCreativeInput) {
  return primaryActress(input)
    ?? input.seriesName
    ?? input.genre?.split(/[,、/]/)[0]?.trim()
    ?? null;
}

export function safeTitleFragment(input: XCreativeInput) {
  const first = input.title.split(/[。！？!?]/)[0]?.trim() ?? input.title;
  if (getXWeightedLength(first) <= 28) return `「${first}」`;
  const actress = primaryActress(input);
  return actress ? `${actress}の一本` : input.genre ? `${input.genre.split(/[,、/]/)[0]}の一本` : "この一本";
}

export function primaryVideoTag(input: XCreativeInput): XVideoManualTag | null {
  const tags = input.mediaManualTags ?? [];
  return VIDEO_TAG_PRIORITY.find((tag) => tags.includes(tag)) ?? null;
}
