import { calculateHookScore, buildXCreativeVariants } from "@/lib/xCreativeEngine";
import type { XCreativeInput } from "@/lib/xCreativeTypes";
import type { DecisionFacts } from "@/lib/domain/decisionFacts";
import type { XPostCandidate } from "./xPostPlanner";
import type { XPostLog } from "./xPostLogs";
import type { CandidateWork, FunnelStat } from "./xPostPlannerData";
import type { XPostPriceChart } from "./xPostPlannerPriceChart";
import { getXWeightedLength, truncateXText } from "@/lib/xText";

export type CandidatePresentation = {
  label: string;
  reason: string;
  selectionReason: string;
  creativeKind: XPostCandidate["creativeKind"];
  lines: string[];
  discoveryScoreValue: number | null;
  buyTimingScoreValue: number | null;
};

export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function plannedAtFor(category: XPostCandidate["category"]) {
  const slot = category === "today_buy" || category === "deal"
    ? { key: "morning" as const, hour: 8 }
    : category === "actress_best" || category === "genre_best" || category === "maker_best" || category === "series_best" || category === "comparison_pick"
      ? { key: "night" as const, hour: 22 }
      : { key: "lunch" as const, hour: 12 };
  const date = todayKey();
  const planned = new Date(`${date}T${String(slot.hour).padStart(2, "0")}:30:00+09:00`);
  return { recommendedSlot: slot.key, plannedAt: planned.toISOString() };
}

const CATEGORY_SOURCE_TYPES: Partial<Record<XPostCandidate["category"], XPostCandidate["sourceType"]>> = {
  market_scan: "MARKET",
  comparison_pick: "COMPARISON",
  judgment_pick: "JUDGMENT",
  review_gap: "JUDGMENT",
  discovery_gap: "HIDDEN_GEM",
  hidden_gem: "HIDDEN_GEM",
  today_discovery: "HIDDEN_GEM",
  actress_best: "ACTRESS_TREND",
  genre_best: "GENRE_TREND",
  maker_best: "MAKER_TREND",
};
const RADAR_CATEGORIES = new Set<XPostCandidate["category"]>([
  "actress_best",
  "genre_best",
  "maker_best",
  "series_best",
  "market_scan",
  "comparison_pick",
  "judgment_pick",
  "review_gap",
]);

function priceEventSourceTypeFor(work: CandidateWork, chart: XPostPriceChart | null): XPostCandidate["sourceType"] {
  return chart?.isNinetyDayLow || work.sale_end_at ? "PRICE_EVENT" : "MONEY";
}

function seriesSourceTypeFor(chart: XPostPriceChart | null): XPostCandidate["sourceType"] {
  return chart?.seriesObservationCount && chart.seriesObservationCount >= 2 ? "FOLLOW_UP" : "COMPARISON";
}

function fallbackSourceTypeFor(work: CandidateWork): XPostCandidate["sourceType"] {
  if (work.review_average && work.review_average >= 4.6 && work.ranking && work.ranking > 80) return "JUDGMENT";
  if (work.ranking && work.ranking <= 30) return "MARKET";
  if (work.series) return "FOLLOW_UP";
  return "WORK";
}

function sourceTypeFor(category: XPostCandidate["category"], work: CandidateWork, chart: XPostPriceChart | null): XPostCandidate["sourceType"] {
  const categorySourceType = CATEGORY_SOURCE_TYPES[category];
  if (categorySourceType) return categorySourceType;
  if (category === "today_buy" || category === "deal") return priceEventSourceTypeFor(work, chart);
  if (category === "series_best") return seriesSourceTypeFor(chart);
  return fallbackSourceTypeFor(work);
}

function fitPost(lines: string[], title: string) {
  let limit = 72;
  let text = lines.map((line) => line.replace("__TITLE__", truncateXText(title, limit))).join("\n");
  while (getXWeightedLength(text) > 280 && limit > 20) {
    limit -= 2;
    text = lines.map((line) => line.replace("__TITLE__", truncateXText(title, limit))).join("\n");
  }
  return text;
}

type CandidateCreativePlanContext = {
  work: CandidateWork;
  category: XPostCandidate["category"];
  chart: XPostPriceChart | null;
  funnel: FunnelStat;
  logs: XPostLog[];
  price: number | null;
  regular: number | null;
  discountRate: number;
  url: string;
  presentationFacts: DecisionFacts;
  presentation: CandidatePresentation;
};

function candidateCreativeWorkFieldsFor(context: CandidateCreativePlanContext): Pick<
  XCreativeInput,
  | "key"
  | "title"
  | "category"
  | "actress"
  | "genre"
  | "reviewAverage"
  | "reviewCount"
  | "ranking"
  | "score"
  | "sampleMovieUrl"
  | "hasRightsCheckedMovie"
  | "recentLogs"
> {
  const { work, category, logs } = context;
  return {
    key: category + "-" + work.id,
    title: work.title,
    category,
    actress: work.actress,
    genre: work.genre,
    reviewAverage: work.review_average,
    reviewCount: work.review_count ?? 0,
    ranking: work.ranking,
    score: Math.round(work.score ?? 0),
    sampleMovieUrl: work.sample_movie_url,
    hasRightsCheckedMovie: false,
    recentLogs: logs,
  };
}

function candidateCreativeEvidenceFieldsFor(
  context: CandidateCreativePlanContext,
  sourceType: XPostCandidate["sourceType"],
): Pick<
  XCreativeInput,
  | "currentPrice"
  | "previousPrice"
  | "discountRate"
  | "discoveryScore"
  | "buyTimingScore"
  | "isNinetyDayLow"
  | "decisionFacts"
  | "xPageViews"
  | "xFanzaClicks"
  | "seriesName"
  | "seriesObservationCount"
  | "radarAvailable"
  | "sourceType"
> {
  const { chart, funnel, price, regular, discountRate, presentationFacts, presentation, category } = context;
  return {
    currentPrice: price,
    previousPrice: chart?.previousPrice ?? regular,
    discountRate,
    discoveryScore: presentation.discoveryScoreValue,
    buyTimingScore: presentation.buyTimingScoreValue,
    isNinetyDayLow: chart?.isNinetyDayLow ?? false,
    decisionFacts: presentationFacts,
    xPageViews: funnel.pageViews,
    xFanzaClicks: funnel.fanzaClicks,
    seriesName: chart?.seriesName ?? context.work.series,
    seriesObservationCount: chart?.seriesObservationCount ?? 0,
    radarAvailable: RADAR_CATEGORIES.has(category),
    sourceType,
  };
}

function primaryCreativeVariantFor(creativeVariants: ReturnType<typeof buildXCreativeVariants>) {
  return creativeVariants.find((variant) => variant.quality.passed && variant.weightedLength <= 280)
    ?? creativeVariants.find((variant) => variant.intent === "FOLLOW")
    ?? creativeVariants[0];
}

export function candidateCreativePlanFor(context: CandidateCreativePlanContext) {
  const { work, category, chart, url, presentation } = context;
  const sourceType = sourceTypeFor(category, work, chart);
  const creativeInput: XCreativeInput = {
    ...candidateCreativeWorkFieldsFor(context),
    url,
    ...candidateCreativeEvidenceFieldsFor(context, sourceType),
  };
  const hookScore = calculateHookScore(creativeInput);
  const timing = plannedAtFor(category);
  const creativeVariants = buildXCreativeVariants({ ...creativeInput, recommendedSlot: timing.recommendedSlot }, hookScore);
  const primaryVariant = primaryCreativeVariantFor(creativeVariants);
  const postText = primaryVariant?.bodyText ?? fitPost(presentation.lines, work.title);
  return { workId: work.id, category, sourceType, hookScore, timing, creativeVariants, primaryVariant, postText };
}

function candidateCreativeIdentityFieldsFor(plan: ReturnType<typeof candidateCreativePlanFor>): Pick<
  XPostCandidate,
  "hookType" | "creativeVariantId" | "creativeVariants"
> {
  const { category, hookScore, creativeVariants, primaryVariant } = plan;
  return {
    hookType: primaryVariant?.hookType ?? hookScore.bestHook.type,
    creativeVariantId: primaryVariant?.id ?? category + "-" + plan.workId + "-legacy",
    creativeVariants,
  };
}

function candidateCreativeLinkFieldsFor(plan: ReturnType<typeof candidateCreativePlanFor>): Pick<
  XPostCandidate,
  "imageStrategy" | "linkStrategy" | "ctaStrategy" | "replyText" | "postIntent" | "growthGoal"
> {
  const { primaryVariant } = plan;
  return {
    imageStrategy: primaryVariant?.imageStrategy ?? "original_work_image",
    linkStrategy: primaryVariant?.linkStrategy ?? "body_link",
    ctaStrategy: primaryVariant?.ctaStrategy ?? "reason_cta",
    replyText: primaryVariant?.replyText ?? null,
    postIntent: "work_link",
    growthGoal: primaryVariant?.linkStrategy === "reply_link" ? "profile_visit" : "fanza_click",
  };
}

function candidateCreativeTimingFieldsFor(plan: ReturnType<typeof candidateCreativePlanFor>): Pick<
  XPostCandidate,
  "recommendedSlot" | "plannedAt"
> {
  return {
    recommendedSlot: plan.timing.recommendedSlot,
    plannedAt: plan.timing.plannedAt,
  };
}

export function candidateCreativeFieldsFor(plan: ReturnType<typeof candidateCreativePlanFor>): Pick<
  XPostCandidate,
  | "hookType"
  | "creativeVariantId"
  | "creativeVariants"
  | "imageStrategy"
  | "linkStrategy"
  | "ctaStrategy"
  | "replyText"
  | "postIntent"
  | "recommendedSlot"
  | "plannedAt"
  | "growthGoal"
> {
  return {
    ...candidateCreativeIdentityFieldsFor(plan),
    ...candidateCreativeLinkFieldsFor(plan),
    ...candidateCreativeTimingFieldsFor(plan),
  };
}
