import { calculateAdjustedCtr, calculateBuyTimingScore } from "@/lib/buyTiming";
import { buildDecisionFacts, type DecisionFacts, type DecisionType } from "@/lib/domain/decisionFacts";
import { calculateDiscoveryScore } from "@/lib/discoveryScore";
import { parseDatabaseDate } from "@/lib/dateTime";
import type { XPostCandidate } from "../xPostPlanner";
import type { XPostLog } from "../xPostLogs";
import { buildFunnelScore, type CandidateWork, type FunnelStat } from "./xPostPlannerData";
import type { XPostPriceChart } from "./xPostPlannerPriceChart";
import { getXWeightedLength } from "@/lib/xText";
import { candidateCreativeFieldsFor, candidateCreativePlanFor, type CandidatePresentation } from "./xPostPlannerCandidateCreative";
export { todayKey } from "./xPostPlannerCandidateCreative";
function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hakkutsu-lab.com").replace(/\/$/, "");
}

export function activeSale(work: CandidateWork) {
  return Boolean(
    work.is_on_sale && work.sale_price && work.sale_price > 0 &&
    (!work.sale_end_at || (parseDatabaseDate(work.sale_end_at)?.getTime() ?? 0) > Date.now()),
  );
}

export function currentPrice(work: CandidateWork) {
  if (activeSale(work)) return work.sale_price;
  return work.price && work.price > 0 ? work.price : null;
}

type CandidatePresentationContext = {
  work: CandidateWork;
  category: XPostCandidate["category"];
  chart: XPostPriceChart | null;
  cooldownDays: number;
  funnel: FunnelStat;
  price: number | null;
  discountRate: number;
  url: string;
  priceText: string;
};

type CandidatePresentationBuilder = (context: CandidatePresentationContext) => CandidatePresentation;

function initialCandidatePresentation(context: CandidatePresentationContext): CandidatePresentation {
  const { work, cooldownDays, url } = context;
  const reason = `発掘スコア${Math.round(work.score ?? 0)}点`;
  return {
    label: "AI発掘",
    reason,
    selectionReason: `価格・評価・人気を分析。${cooldownDays}日間の作品重複を回避。`,
    creativeKind: "discovery",
    lines: ["【今日のAI発掘】", "「__TITLE__」", `${reason}。サンプルと価格を一緒に確認。`, url, "#PR #FANZA"],
    discoveryScoreValue: null,
    buyTimingScoreValue: null,
  };
}

function dealPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  const { chart, price, discountRate, priceText } = context;
  const rate = chart?.previousPrice && price ? Math.round((1 - price / chart.previousPrice) * 100) : discountRate;
  presentation.label = "価格アラート";
  presentation.reason = chart?.previousPrice && price
    ? `${chart.previousPrice.toLocaleString("ja-JP")}円 → ${price.toLocaleString("ja-JP")}円（${rate}%下落）`
    : `${discountRate}%OFF・${priceText}`;
  presentation.selectionReason = `同じ販売形式・期間の履歴で値下げを確認。${chart?.seriesName ?? "価格系列"}${chart?.seriesPeriod ? `（${chart.seriesPeriod}）` : ""}。`;
  presentation.creativeKind = "price-chart";
  presentation.lines = ["【価格アラート】", "「__TITLE__」", `${presentation.reason}。実際の価格推移をグラフで確認。`, context.url, "#PR #FANZA"];
  return presentation;
}

function newPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  const { work, priceText } = context;
  presentation.label = "新作発掘";
  presentation.reason = work.release_date ? `発売 ${work.release_date.slice(0, 10)}・${priceText}` : `新作・${priceText}`;
  presentation.selectionReason = `新作候補から日付固定で分散選出。${context.cooldownDays}日間の作品重複を回避。`;
  presentation.lines = ["【新作を発掘】", "「__TITLE__」", `${presentation.reason}。まずサンプルで雰囲気を確認。`, context.url, "#PR #FANZA"];
  return presentation;
}

function salesPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  presentation.label = "実績発掘";
  presentation.reason = `販売実績あり・${context.priceText}`;
  presentation.selectionReason = `実際の販売実績がある候補。${context.cooldownDays}日間の作品重複を回避。`;
  presentation.lines = ["【実際に選ばれた作品】", "「__TITLE__」", `${context.priceText}。迷ったときの比較候補に。`, context.url, "#PR #FANZA"];
  return presentation;
}

function discoveryScoreInputFor(context: Pick<CandidatePresentationContext, "work" | "chart" | "funnel">) {
  const { work, chart, funnel } = context;
  const adjustedCtr = calculateAdjustedCtr(funnel.pageViews, funnel.fanzaClicks);
  return {
    work,
    priceHistory: (chart?.points ?? []).map((point) => ({ normal_price: point.price, sale_price: null })),
    funnel: {
      pageViews: funnel.pageViews,
      fanzaClicks: funnel.fanzaClicks,
      rawCtr: funnel.ctr,
      adjustedCtr: adjustedCtr.adjustedCtr,
      confidence: adjustedCtr.confidence,
    },
  };
}

function discoverySelectionReasonFor(work: CandidateWork, discovery: ReturnType<typeof calculateDiscoveryScore>) {
  return `ランキング${work.ranking ?? "未取得"}位、評価${work.review_average?.toFixed(1) ?? "未取得"}、レビュー${work.review_count ?? 0}件。${discovery.reasons.slice(0, 2).join("。")}。`;
}

function discoveryPostLinesFor(
  context: CandidatePresentationContext,
  discoveryScore: number,
  buyTimingScore: number,
) {
  const { work, category, discountRate, url } = context;
  const categoryTitle = category === "today_discovery" ? "今日の発掘" : "値下げ×埋もれ名作";
  return [
    `【${categoryTitle}】`,
    "「__TITLE__」",
    `ランキング${work.ranking ?? "未取得"}位 / 評価${work.review_average?.toFixed(1) ?? "-"} / レビュー${work.review_count ?? 0}件`,
    `${discountRate}%OFF / 発掘指数${discoveryScore} / 買い時${buyTimingScore}`,
    url,
    "#PR #FANZA",
  ];
}

function discoveryPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  const { work, chart, category } = context;
  const scoreInput = discoveryScoreInputFor(context);
  const buyTiming = calculateBuyTimingScore(scoreInput);
  const discovery = calculateDiscoveryScore({ ...scoreInput, buyTimingScore: buyTiming.score });
  presentation.discoveryScoreValue = discovery.score;
  presentation.buyTimingScoreValue = buyTiming.score;
  presentation.label = category === "today_discovery" ? "今日の発掘" : "値下げ×埋もれ名作";
  presentation.reason = `発掘指数${discovery.score}・買い時${buyTiming.score}`;
  presentation.selectionReason = discoverySelectionReasonFor(work, discovery);
  presentation.creativeKind = chart?.hadPriceDrop ? "price-chart" : "discovery";
  presentation.lines = discoveryPostLinesFor(context, discovery.score, buyTiming.score);
  return presentation;
}

function todayBuyPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  const { work, chart, funnel, discountRate, priceText, url } = context;
  const adjustedCtr = calculateAdjustedCtr(funnel.pageViews, funnel.fanzaClicks);
  const buyTiming = calculateBuyTimingScore({
    work,
    priceHistory: (chart?.points ?? []).map((point) => ({ normal_price: point.price, sale_price: null })),
    funnel: {
      pageViews: funnel.pageViews,
      fanzaClicks: funnel.fanzaClicks,
      rawCtr: funnel.ctr,
      adjustedCtr: adjustedCtr.adjustedCtr,
      confidence: adjustedCtr.confidence,
    },
  });
  presentation.buyTimingScoreValue = buyTiming.score;
  presentation.label = "今日の買い時";
  presentation.reason = `買い時${buyTiming.score}・${discountRate}%OFF・${priceText}`;
  presentation.selectionReason = `買い時スコアと価格条件で選出。${buyTiming.reasons.slice(0, 2).join("。")}。`;
  presentation.creativeKind = "price-chart";
  presentation.lines = ["【今日の買い時】", "「__TITLE__」", `${priceText} / ${discountRate}%OFF / 買い時${buyTiming.score}`, "価格とサンプルを見て判断できます。", url, "#PR #FANZA"];
  return presentation;
}

type MarketPresentationCategory = "market_scan" | "comparison_pick" | "judgment_pick" | "review_gap" | "discovery_gap";

function marketScanSelectionReasonFor(work: CandidateWork, genreName?: string, makerName?: string) {
  const focus = genreName ? `${genreName}系` : makerName ? `${makerName}系` : "同条件";
  return `今日のセール群から${focus}に寄った作品を抽出。ランキング${work.ranking ?? "未取得"}位、評価${work.review_average?.toFixed(1) ?? "未取得"}。`;
}

function setMarketScanPresentation(context: CandidatePresentationContext, presentation: CandidatePresentation) {
  const { work, discountRate } = context;
  const genreName = work.genre?.split(/[,、/]/)[0]?.trim();
  const makerName = work.maker?.trim();
  presentation.label = "市場メモ";
  presentation.reason = `${discountRate}%OFF・${genreName ?? makerName ?? "注目枠"}`;
  presentation.selectionReason = marketScanSelectionReasonFor(work, genreName, makerName);
  presentation.creativeKind = "comparison";
  presentation.lines = ["【今日の市場メモ】", genreName ? `今日のセール欄は${genreName}寄り。` : "今日のセール欄は上位だけだと少し見落としそう。", `代表: 「__TITLE__」`, `${discountRate}%OFF / 評価${work.review_average?.toFixed(1) ?? "-"}`, "#PR #FANZA"];
}

function setComparisonPresentation(context: CandidatePresentationContext, presentation: CandidatePresentation) {
  const { work, discountRate } = context;
  const genreName = work.genre?.split(/[,、/]/)[0]?.trim();
  presentation.label = "比較メモ";
  presentation.reason = `${discountRate}%OFF・評価${work.review_average?.toFixed(1) ?? "-"}`;
  presentation.selectionReason = `同価格帯/同割引率で比較しやすい作品を抽出。ジャンル${genreName ?? "未取得"}、ランキング${work.ranking ?? "未取得"}位。`;
  presentation.creativeKind = "comparison";
  presentation.lines = ["【比較メモ】", `同じ${discountRate}%OFFでも先に見るならこちら。`, "「__TITLE__」", `評価${work.review_average?.toFixed(1) ?? "-"} / レビュー${work.review_count ?? 0}件`, "#PR #FANZA"];
}

function setJudgmentPresentation(context: CandidatePresentationContext, presentation: CandidatePresentation) {
  const { work, discountRate } = context;
  presentation.label = "見送り判断";
  presentation.reason = `${discountRate}%OFF・評価${work.review_average?.toFixed(1) ?? "-"}`;
  presentation.selectionReason = "値引きはあるが評価/レビュー/順位の押しが弱い作品を抽出。買わない判断も投稿価値として扱う。";
  presentation.creativeKind = "comparison";
  presentation.lines = ["【今日は見送り】", `${discountRate}%OFFでも急がなくていい一本。`, "「__TITLE__」", `評価${work.review_average?.toFixed(1) ?? "-"} / レビュー${work.review_count ?? 0}件`, "#PR #FANZA"];
}

function setReviewGapPresentation(context: CandidatePresentationContext, presentation: CandidatePresentation) {
  const { work } = context;
  presentation.label = "レビューギャップ";
  presentation.reason = `評価${work.review_average?.toFixed(1) ?? "-"}・レビュー${work.review_count ?? 0}件`;
  presentation.selectionReason = `評価とレビュー件数/順位のズレを抽出。ランキング${work.ranking ?? "未取得"}位、レビュー${work.review_count ?? 0}件。`;
  presentation.creativeKind = "comparison";
  presentation.lines = ["【レビューのズレ】", "評価と順位のズレが気になる一本。", "「__TITLE__」", `評価${work.review_average?.toFixed(1) ?? "-"} / ランキング${work.ranking ?? "未取得"}位`, "#PR #FANZA"];
}

function setDiscoveryGapPresentation(context: CandidatePresentationContext, presentation: CandidatePresentation) {
  const { work } = context;
  presentation.label = "発掘ギャップ";
  presentation.reason = `高評価×低順位・評価${work.review_average?.toFixed(1) ?? "-"}`;
  presentation.selectionReason = "高評価だがランキング/PVが弱い作品を抽出。DISCOVERY_GAPとして初見ユーザー向けに使う。";
  presentation.creativeKind = "discovery";
  presentation.lines = ["【発掘ギャップ】", "高評価なのに静かな一本。", "「__TITLE__」", `評価${work.review_average?.toFixed(1) ?? "-"} / ランキング${work.ranking ?? "未取得"}位`, "#PR #FANZA"];
}

const MARKET_PRESENTATION_BUILDERS: Record<MarketPresentationCategory, (context: CandidatePresentationContext, presentation: CandidatePresentation) => void> = {
  market_scan: setMarketScanPresentation,
  comparison_pick: setComparisonPresentation,
  judgment_pick: setJudgmentPresentation,
  review_gap: setReviewGapPresentation,
  discovery_gap: setDiscoveryGapPresentation,
};

function marketPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  MARKET_PRESENTATION_BUILDERS[context.category as MarketPresentationCategory](context, presentation);
  return presentation;
}

type EntityPresentationCategory = "actress_best" | "genre_best" | "maker_best" | "series_best";

const ENTITY_PRESENTATION_DETAILS: Record<EntityPresentationCategory, { label: string; nameFor: (work: CandidateWork) => string | undefined }> = {
  actress_best: { label: "女優別おすすめ", nameFor: (work) => work.actress?.split(/[,、/]/)[0]?.trim() },
  genre_best: { label: "ジャンル別おすすめ", nameFor: (work) => work.genre?.split(/[,、/]/)[0]?.trim() },
  maker_best: { label: "メーカー別おすすめ", nameFor: (work) => work.maker?.trim() },
  series_best: { label: "シリーズ別おすすめ", nameFor: (work) => work.series?.trim() },
};

function entityPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  const { work, priceText, url, cooldownDays } = context;
  const { label, nameFor } = ENTITY_PRESENTATION_DETAILS[context.category as EntityPresentationCategory];
  const entityName = nameFor(work);
  presentation.label = label;
  presentation.reason = `${entityName ?? "注目条件"}のおすすめ・評価${work.review_average?.toFixed(1) ?? "-"}・レビュー${work.review_count ?? 0}件`;
  presentation.selectionReason = `${entityName ?? "注目条件"}ページのBEST10導線に使う候補。作品重複を${cooldownDays}日間回避。`;
  presentation.lines = [
    `【${label}】`,
    entityName ? `${entityName}で探すなら候補に入れたい一本。` : "条件別で探すなら候補に入れたい一本。",
    "「__TITLE__」",
    `評価${work.review_average?.toFixed(1) ?? "-"} / レビュー${work.review_count ?? 0}件 / ${priceText}`,
    url,
    "#PR #FANZA",
  ];
  return presentation;
}

function defaultPresentationFor(context: CandidatePresentationContext): CandidatePresentation {
  const presentation = initialCandidatePresentation(context);
  const { work } = context;
  if (work.review_average && work.review_count) {
    presentation.reason = `評価${work.review_average.toFixed(1)}・レビュー${work.review_count}件`;
    presentation.lines = ["【今日のAI発掘】", "「__TITLE__」", `${presentation.reason}。評価だけでなく価格推移も確認。`, context.url, "#PR #FANZA"];
  }
  return presentation;
}

const CANDIDATE_PRESENTATION_BUILDERS: Partial<Record<XPostCandidate["category"], CandidatePresentationBuilder>> = {
  sales: salesPresentationFor,
  deal: dealPresentationFor,
  new: newPresentationFor,
  hidden_gem: discoveryPresentationFor,
  today_discovery: discoveryPresentationFor,
  today_buy: todayBuyPresentationFor,
  market_scan: marketPresentationFor,
  comparison_pick: marketPresentationFor,
  judgment_pick: marketPresentationFor,
  review_gap: marketPresentationFor,
  discovery_gap: marketPresentationFor,
  actress_best: entityPresentationFor,
  genre_best: entityPresentationFor,
  maker_best: entityPresentationFor,
  series_best: entityPresentationFor,
};

function candidatePresentationFor(context: CandidatePresentationContext) {
  return CANDIDATE_PRESENTATION_BUILDERS[context.category]?.(context) ?? defaultPresentationFor(context);
}

type CandidatePriceFacts = {
  price: number | null;
  regular: number | null;
  discountRate: number;
};

function candidatePriceFactsFor(work: CandidateWork, chart: XPostPriceChart | null): CandidatePriceFacts {
  const price = currentPrice(work);
  const regular = work.list_price && price && work.list_price > price
    ? work.list_price
    : chart?.previousPrice && price && chart.previousPrice > price ? chart.previousPrice : null;
  return { price, regular, discountRate: regular && price ? Math.round((1 - price / regular) * 100) : 0 };
}

function recordedLowestPriceFor(work: CandidateWork, chart: XPostPriceChart | null) {
  return work.lowest_price && work.lowest_price > 0 ? work.lowest_price : chart?.seriesMinimumPrice ?? null;
}

function candidatePriceSeriesFactsFor(chart: XPostPriceChart | null) {
  if (!chart) {
    return {
      recordedLowestAt: null,
      coverageStart: null,
      coverageEnd: null,
      priceSeries: { displayName: null, period: null },
      newRecordedLowToday: null,
    };
  }

  return {
    recordedLowestAt: chart.seriesLowestAt ?? null,
    coverageStart: chart.seriesStartedAt ?? null,
    coverageEnd: chart.checkedAt ?? null,
    priceSeries: { displayName: chart.seriesName ?? null, period: chart.seriesPeriod ?? null },
    newRecordedLowToday: chart.newRecordedLowToday ?? null,
  };
}

function candidateDecisionFactsFor(
  work: CandidateWork,
  chart: XPostPriceChart | null,
  price: number | null,
  discountRate: number,
  presentationDecisionType?: Exclude<DecisionType, "UNKNOWN">,
) {
  const decisionFacts = buildDecisionFacts({
    currentPrice: price,
    // Persisted work.lowest_price is the catalog decision source; chart remains the evidence and coverage view.
    recordedLowestPrice: recordedLowestPriceFor(work, chart),
    discountRate,
    isOnSale: activeSale(work),
    ranking: work.ranking,
    reviewAverage: work.review_average,
    reviewCount: work.review_count,
    ...candidatePriceSeriesFactsFor(chart),
  });
  return {
    decisionFacts,
    presentationFacts: presentationDecisionType ? { ...decisionFacts, decisionType: presentationDecisionType } : decisionFacts,
  };
}

function candidateChartSeriesIdentityFor(chart: XPostPriceChart | null): Pick<XPostCandidate, "seriesName" | "seriesPeriod" | "seriesObservationCount" | "seriesStartedAt"> {
  return {
    seriesName: chart?.seriesName ?? null,
    seriesPeriod: chart?.seriesPeriod ?? null,
    seriesObservationCount: chart?.seriesObservationCount ?? 0,
    seriesStartedAt: chart?.seriesStartedAt ?? null,
  };
}

function candidateChartSeriesPricesFor(chart: XPostPriceChart | null): Pick<XPostCandidate, "chartPoints" | "seriesMinimumPrice" | "seriesMaximumPrice"> {
  return {
    chartPoints: chart?.points ?? [],
    seriesMinimumPrice: chart?.seriesMinimumPrice ?? null,
    seriesMaximumPrice: chart?.seriesMaximumPrice ?? null,
  };
}

function candidateChartSeriesStatusFor(chart: XPostPriceChart | null): Pick<XPostCandidate, "seriesLowestAt" | "newRecordedLowToday" | "isNinetyDayLow"> {
  return {
    seriesLowestAt: chart?.seriesLowestAt ?? null,
    newRecordedLowToday: chart?.newRecordedLowToday ?? null,
    isNinetyDayLow: chart?.isNinetyDayLow ?? false,
  };
}

function candidateChartFieldsFor(chart: XPostPriceChart | null): Pick<
  XPostCandidate,
  | "checkedAt"
  | "previousPrice"
  | "seriesName"
  | "seriesPeriod"
  | "chartPoints"
  | "seriesMinimumPrice"
  | "seriesMaximumPrice"
  | "seriesObservationCount"
  | "seriesStartedAt"
  | "seriesLowestAt"
  | "newRecordedLowToday"
  | "isNinetyDayLow"
> {
  return {
    checkedAt: chart?.checkedAt ?? new Date().toISOString(),
    previousPrice: chart?.previousPrice ?? null,
    ...candidateChartSeriesIdentityFor(chart),
    ...candidateChartSeriesPricesFor(chart),
    ...candidateChartSeriesStatusFor(chart),
  };
}

function candidateRecordFor(context: {
  work: CandidateWork;
  category: XPostCandidate["category"];
  chart: XPostPriceChart | null;
  cooldownDays: number;
  funnel: FunnelStat;
  price: number | null;
  discountRate: number;
  presentationFacts: DecisionFacts;
  presentation: CandidatePresentation;
  selectionReason: string;
  funnelScore: number;
  creativePlan: ReturnType<typeof candidateCreativePlanFor>;
}): XPostCandidate {
  const { work, category, chart, cooldownDays, funnel, price, discountRate, presentationFacts, presentation, selectionReason, funnelScore, creativePlan } = context;
  return {
    key: category + "-" + work.id,
    workId: work.id,
    productId: work.product_id,
    title: work.title,
    actress: work.actress,
    genre: work.genre,
    maker: work.maker,
    category,
    sourceType: creativePlan.sourceType,
    label: presentation.label,
    reason: presentation.reason,
    selectionReason,
    postText: creativePlan.postText,
    weightedLength: getXWeightedLength(creativePlan.postText),
    currentPrice: price,
    discountRate,
    reviewAverage: work.review_average,
    reviewCount: work.review_count ?? 0,
    score: Math.round(work.score ?? 0),
    discoveryScore: presentation.discoveryScoreValue,
    buyTimingScore: presentation.buyTimingScoreValue,
    ranking: work.ranking,
    funnelScore,
    xPageViews: funnel.pageViews,
    xFanzaClicks: funnel.fanzaClicks,
    xCtr: funnel.ctr,
    cooldownDays,
    creativeKind: presentation.creativeKind,
    hookScore: creativePlan.hookScore,
    ...candidateChartFieldsFor(chart),
    ...candidateCreativeFieldsFor(creativePlan),
    sampleMovieUrl: work.sample_movie_url,
    imageUrl: work.image_url,
    saleEndAt: work.sale_end_at,
    decisionFacts: presentationFacts,
  };
}

export function makeCandidate(
  work: CandidateWork,
  category: XPostCandidate["category"],
  chart: XPostPriceChart | null,
  cooldownDays: number,
  funnel: FunnelStat,
  logs: XPostLog[],
  presentationDecisionType?: Exclude<DecisionType, "UNKNOWN">,
): XPostCandidate {
  const { price, regular, discountRate } = candidatePriceFactsFor(work, chart);
  const { presentationFacts } = candidateDecisionFactsFor(work, chart, price, discountRate, presentationDecisionType);
  const url = siteUrl() + "/works/" + work.id + "?from=x&x_post=" + encodeURIComponent(category + "-" + work.id);
  const priceText = price ? "¥" + price.toLocaleString("ja-JP") : "価格は詳細で確認";
  const presentation = candidatePresentationFor({ work, category, chart, cooldownDays, funnel, price, discountRate, url, priceText });
  const funnelScore = buildFunnelScore(work, category, chart, funnel);
  const funnelReason = funnel.pageViews > 0
    ? "直近30日X流入 " + funnel.pageViews + "PV / FANZA " + funnel.fanzaClicks + "回 / CTR " + funnel.ctr + "%。"
    : "X流入は未検証。初期データを取りにいく候補。";
  const selectionReason = presentation.selectionReason + " " + funnelReason;
  const creativePlan = candidateCreativePlanFor({
    work,
    category,
    chart,
    funnel,
    logs,
    price,
    regular,
    discountRate,
    url,
    presentationFacts,
    presentation,
  });
  return candidateRecordFor({
    work,
    category,
    chart,
    cooldownDays,
    funnel,
    price,
    discountRate,
    presentationFacts,
    presentation,
    selectionReason,
    funnelScore,
    creativePlan,
  });
}
