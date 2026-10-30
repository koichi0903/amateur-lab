import { buildXCreativeVariants, calculateHookScore, type XCreativeVariant } from "@/lib/xCreativeEngine";
import { buildVisualVideoFacts, type XVisualVideoFacts, visualFactScores } from "@/lib/xVisualVideoFacts";
import { officialSampleVideoAllowed } from "./xGrowthEligibility";
import type { XGrowthOpportunity } from "./xGrowthOS";
import type { XPostLog } from "./xPostLogs";

function rankingHistoryFields(item: XGrowthOpportunity) {
  const rankingReady = item.rankingHistory.status === "ready";
  return {
    rankingHistoryCount: item.rankingHistory.observations,
    previousRanking: rankingReady ? item.rankingHistory.previousRanking : null,
    rankingDelta: rankingReady ? item.rankingHistory.rankingDelta : null,
  };
}

function createCreativeInput(item: XGrowthOpportunity, logs: XPostLog[], visualFacts: XVisualVideoFacts) {
  return {
    key: item.key,
    title: item.title,
    url: item.creativeVariants[0]?.url ?? "",
    category: item.category,
    actress: item.actress,
    genre: item.genre,
    currentPrice: item.currentPrice,
    previousPrice: item.previousPrice,
    discountRate: item.discountRate,
    reviewAverage: item.reviewAverage,
    reviewCount: item.reviewCount,
    ranking: item.ranking,
    score: item.score,
    discoveryScore: item.discoveryScore,
    buyTimingScore: item.buyTimingScore,
    isNinetyDayLow: item.isNinetyDayLow,
    decisionFacts: item.decisionFacts,
    sampleMovieUrl: item.sampleMovieUrl,
    imageUrl: item.imageUrl,
    saleEndAt: item.saleEndAt,
    hasRightsCheckedMovie: item.canNativeVideo || officialSampleVideoAllowed(item),
    mediaManualTags: item.mediaAsset?.manual_tags ?? [],
    mediaQuality: item.mediaAsset?.media_quality ?? "unreviewed",
    xPageViews: item.xPageViews,
    xFanzaClicks: item.xFanzaClicks,
    seriesName: item.seriesName,
    seriesObservationCount: item.seriesObservationCount,
    ...rankingHistoryFields(item),
    recentLogs: logs,
    radarAvailable: item.intent === "CONVERSATION" || Boolean(item.seriesName || item.actress || item.genre),
    recommendedSlot: item.recommendedSlot,
    sourceType: item.sourceType,
    visualFacts,
  };
}

function createRealMediaVariants(
  item: XGrowthOpportunity,
  creativeInput: Parameters<typeof calculateHookScore>[0],
  hookScore: ReturnType<typeof calculateHookScore>,
) {
  const variants = buildXCreativeVariants(creativeInput, hookScore);
  // A work with an official sample and a real work image must retain both
  // media paths. Ranking chooses one representative per work later; dropping
  // the image here would make the image side of the final mix impossible after
  // the video quota is filled.
  const imageFallbackVariants = item.imageUrl && variants.some((variant) => variant.mediaType === "sample_movie")
    ? buildXCreativeVariants({
      ...creativeInput,
      sampleMovieUrl: null,
      hasRightsCheckedMovie: false,
      visualFacts: null,
    }, hookScore)
    : [];
  return [...variants, ...imageFallbackVariants].map((variant) => variant.mediaType === "data_card" && item.imageUrl && item.sourceType !== "PRICE_EVENT"
    ? { ...variant, mediaType: "existing_link_image" as const, imageStrategy: "original_work_image" as const }
    : variant);
}

function recommendedVariantFor(item: XGrowthOpportunity, variants: XCreativeVariant[]) {
  return variants.find((variant) => variant.intent === item.intent && variant.quality.passed)
    ?? variants.find((variant) => variant.quality.passed)
    ?? variants[0];
}

function resolveMediaType(item: XGrowthOpportunity, recommended: XCreativeVariant | undefined): XGrowthOpportunity["mediaType"] {
  const mediaType = recommended?.mediaType ?? item.mediaType;
  if (mediaType !== "sample_movie" || officialSampleVideoAllowed(item)) return mediaType;
  return item.imageUrl ? "existing_link_image" : "text";
}

function recommendedMediaUrlFor(item: XGrowthOpportunity, mediaType: XGrowthOpportunity["mediaType"]) {
  switch (mediaType) {
    case "sample_movie": return item.mediaAsset?.source_url ?? item.sampleMovieUrl;
    case "existing_link_image": return item.imageUrl;
    case "data_card": return `/api/admin/x-growth/media/download?workId=${item.workId}&mediaType=data_card`;
    default: return null;
  }
}

function mediaUsageFor(mediaType: XGrowthOpportunity["mediaType"], mediaUrl: string | null) {
  if (mediaType === "sample_movie" || mediaUrl || mediaType === "text" || mediaType === "quote") return "allowed" as const;
  return "not_available" as const;
}

function recommendedTextFields(item: XGrowthOpportunity, recommended: XCreativeVariant | undefined, hookScore: ReturnType<typeof calculateHookScore>) {
  return {
    postText: recommended?.bodyText ?? item.postText,
    replyText: recommended?.replyText ?? null,
    weightedLength: recommended?.weightedLength ?? item.weightedLength,
    hookScore,
    hookType: recommended?.hookType ?? item.hookType,
  };
}

function recommendedStrategyFields(item: XGrowthOpportunity, recommended: XCreativeVariant | undefined) {
  return {
    creativeVariantId: recommended?.id ?? item.creativeVariantId,
    imageStrategy: recommended?.imageStrategy ?? item.imageStrategy,
    linkStrategy: recommended?.linkStrategy ?? item.linkStrategy,
    ctaStrategy: recommended?.ctaStrategy ?? item.ctaStrategy,
  };
}

function recommendedMediaFields(item: XGrowthOpportunity, mediaType: XGrowthOpportunity["mediaType"], mediaUrl: string | null) {
  return {
    mediaUsage: mediaUsageFor(mediaType, mediaUrl),
    recommendedMediaUrl: mediaUrl,
    mediaDecision: mediaDecisionFor(item, mediaType),
  };
}

function mediaDecisionFor(item: XGrowthOpportunity, mediaType: XGrowthOpportunity["mediaType"]) {
  switch (mediaType) {
    case "sample_movie": return "公式FANZA/DMM sample_movie_urlを無加工投稿用のネイティブ動画として使用可";
    case "existing_link_image": return item.intent === "MONEY"
      ? "MONEY投稿は現在Xで使っている作品リンク画像を維持"
      : "作品画像を優先。本文は画像説明ではなく見る理由に絞る";
    case "data_card": return item.sourceType === "PRICE_EVENT"
      ? "現在価格・発掘LABの記録最安・期限を載せた価格カード"
      : "作品画像URLを確認し、データカード素材として使用";
    case "quote": return "外部投稿確認後の引用候補。自動引用はしない";
    default: return "利用可能な画像/動画がないためテキストのみ";
  }
}

function createCreativeQualityResult(input: {
  item: XGrowthOpportunity;
  variants: XCreativeVariant[];
  recommended: XCreativeVariant | undefined;
  hookScore: ReturnType<typeof calculateHookScore>;
  mediaType: XGrowthOpportunity["mediaType"];
  mediaUrl: string | null;
  resolvedVisualFacts: XVisualVideoFacts;
}) {
  const { item, variants, recommended, hookScore, mediaType, mediaUrl, resolvedVisualFacts } = input;
  return {
    ...item,
    visualFacts: resolvedVisualFacts,
    visualScoring: visualFactScores(resolvedVisualFacts),
    creativeVariants: variants,
    ...recommendedTextFields(item, recommended, hookScore),
    ...recommendedStrategyFields(item, recommended),
    mediaType,
    ...recommendedMediaFields(item, mediaType, mediaUrl),
    creativeGenome: recommended?.creativeGenome ?? item.creativeGenome,
  };
}

export function withCreativeQuality(item: XGrowthOpportunity, logs: XPostLog[]): XGrowthOpportunity {
  const visualFacts = (item.mediaAsset?.visual_video_facts as XVisualVideoFacts | null | undefined) ?? buildVisualVideoFacts({
    imageUrl: item.imageUrl,
    sampleMovieUrl: item.sampleMovieUrl,
    manualTags: item.mediaAsset?.manual_tags ?? [],
    mediaQuality: item.mediaAsset?.media_quality,
  });
  const creativeInput = createCreativeInput(item, logs, visualFacts);
  const hookScore = calculateHookScore(creativeInput);
  const realMediaVariants = createRealMediaVariants(item, creativeInput, hookScore);
  const recommended = recommendedVariantFor(item, realMediaVariants);
  const resolvedMediaType = resolveMediaType(item, recommended);
  const recommendedMediaUrl = recommendedMediaUrlFor(item, resolvedMediaType);
  const resolvedVisualFacts = resolvedMediaType === "sample_movie"
    ? visualFacts
    : buildVisualVideoFacts({ imageUrl: item.imageUrl });
  return createCreativeQualityResult({
    item,
    variants: realMediaVariants,
    recommended,
    hookScore,
    mediaType: resolvedMediaType,
    mediaUrl: recommendedMediaUrl,
    resolvedVisualFacts,
  });
}
