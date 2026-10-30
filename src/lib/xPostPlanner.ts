import type { AffiliatePerformanceRow } from "@/lib/affiliateSalesAnalytics";
import { parseDatabaseDate } from "@/lib/dateTime";
import {
  decisionFactEligibilityReason,
  HIGH_DISCOUNT_THRESHOLD,
  HIDDEN_VALUE_MIN_DISCOUNT,
  HIDDEN_VALUE_MIN_REVIEW_AVERAGE,
  HIDDEN_VALUE_MIN_REVIEW_COUNT,
  type DecisionFacts,
  type DecisionType,
} from "@/lib/domain/decisionFacts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
import { fnv1aHash } from "@/lib/fnv1aHash";
import {
  type XCreativeVariant,
  type XHookScore,
  type XHookType,
  type XImageStrategy,
  type XLinkStrategy,
  type XCtaStrategy,
} from "@/lib/xCreativeEngine";
import type { XPostLog } from "@/lib/xPostLogs";
import {
  X_POST_PLANNER_DAY_MS as DAY_MS,
  fetchHistory,
  fetchXWorkFunnels,
  type CandidateWork,
  type PriceHistoryRow,
} from "./xPostPlannerData";
import { buildXPostPriceChart, type XChartPoint } from "./xPostPlannerPriceChart";
import { activeSale, currentPrice, makeCandidate, todayKey } from "./xPostPlannerCandidate";

export type { XChartPoint } from "./xPostPlannerPriceChart";

export type DecisionSupplyRejectReason =
  | "missing_current_price"
  | "missing_recorded_low"
  | "current_is_record_low"
  | "not_on_sale"
  | "discount_below_threshold"
  | "ranking_not_outside"
  | "review_average_below_threshold"
  | "review_count_below_threshold"
  | "higher_priority_decision_type"
  | "decision_type_mismatch"
  | "duplicate_work"
  | "weighted_length_exceeded";

type DecisionSupplyDiagnostics = {
  dbFetchedWorks: number;
  dbRawWorks: number;
  afterPostedCooldown: number;
  chartEligible: number;
  uniqueWorks: number;
  creativeVariants: number;
  qualityEligible: number;
  selected: number;
  persisted: number;
  firstDropReasonCounts: Record<string, number>;
  firstDropByWorkId: Record<string, DecisionSupplyRejectReason>;
};

export type XPostCandidate = {
  key: string;
  workId: number;
  productId: string;
  title: string;
  actress: string | null;
  genre: string | null;
  maker: string | null;
  category: "sales" | "deal" | "score" | "new" | "hidden_gem" | "today_buy" | "today_discovery" | "market_scan" | "comparison_pick" | "judgment_pick" | "review_gap" | "discovery_gap" | "actress_best" | "genre_best" | "maker_best" | "series_best";
  sourceType: "WORK" | "MARKET" | "FOLLOW_UP" | "COMPARISON" | "JUDGMENT" | "ACTRESS_TREND" | "GENRE_TREND" | "MAKER_TREND" | "PRICE_EVENT" | "HIDDEN_GEM" | "MONEY";
  label: string;
  reason: string;
  selectionReason: string;
  postText: string;
  weightedLength: number;
  currentPrice: number | null;
  previousPrice: number | null;
  discountRate: number;
  reviewAverage: number | null;
  reviewCount: number;
  score: number;
  salesScoreBonus?: number;
  currentMonthSalesCount?: number;
  prior90DaySalesCount?: number;
  salesReason?: string;
  discoveryScore: number | null;
  buyTimingScore: number | null;
  ranking: number | null;
  checkedAt: string;
  funnelScore: number;
  xPageViews: number;
  xFanzaClicks: number;
  xCtr: number;
  seriesName: string | null;
  seriesPeriod: string | null;
  chartPoints: XChartPoint[];
  seriesMinimumPrice: number | null;
  seriesMaximumPrice: number | null;
  seriesObservationCount: number;
  seriesStartedAt: string | null;
  seriesLowestAt: string | null;
  newRecordedLowToday: boolean | null;
  isNinetyDayLow: boolean;
  cooldownDays: number;
  creativeKind: "price-chart" | "discovery" | "comparison";
  hookScore: XHookScore;
  hookType: XHookType;
  creativeVariantId: string;
  creativeVariants: XCreativeVariant[];
  imageStrategy: XImageStrategy;
  linkStrategy: XLinkStrategy;
  ctaStrategy: XCtaStrategy;
  replyText: string | null;
  postIntent: "work_link";
  recommendedSlot: "morning" | "lunch" | "night";
  plannedAt: string;
  growthGoal: "profile_visit" | "fanza_click" | "follow";
  sampleMovieUrl: string | null;
  imageUrl: string | null;
  saleEndAt: string | null;
  decisionFacts: DecisionFacts;
};

const SELECT_COLUMNS = [
  "id", "product_id", "title", "actress", "maker", "score", "price", "sale_price",
  "genre", "series", "list_price", "discount_rate", "review_average", "review_count", "release_date", "stage",
  "ranking", "lowest_price", "is_bottom_price", "is_on_sale", "sale_end_at", "sample_movie_url", "image_url",
].join(",");

// Candidate generation is intentionally wider than the daily 9-pick target.
// Hard Gates and cross-slot diversity are applied later, after all source pools
// have had a chance to contribute distinct works.
const CANDIDATE_WORK_LIMIT = 500;
const SALE_SAMPLE_MOVIE_WORK_LIMIT = 300;
const ABSOLUTE_COOLDOWN_DAYS = 3;

type SaleSampleMovieSource = Pick<CandidateWork, "id" | "sample_movie_url" | "is_on_sale" | "sale_price" | "sale_end_at">;

export function selectSaleSampleMovieWorks<T extends SaleSampleMovieSource>(
  works: T[],
  postedWorkIds: ReadonlySet<number>,
  limit = SALE_SAMPLE_MOVIE_WORK_LIMIT,
) {
  const activeOfficial = works.filter((work) => {
    if (!work.is_on_sale || !work.sale_price || work.sale_price <= 0) return false;
    if (work.sale_end_at && (parseDatabaseDate(work.sale_end_at)?.getTime() ?? 0) <= Date.now()) return false;
    return isOfficialFanzaDmmSampleUrl(work.sample_movie_url);
  });
  const afterPosted = activeOfficial.filter((work) => !postedWorkIds.has(work.id));
  const safeLimit = Math.max(0, Math.floor(limit));
  return {
    works: afterPosted.slice(0, safeLimit),
    fetched: works.length,
    activeOfficial: activeOfficial.length,
    afterPosted: afterPosted.length,
    selected: Math.min(afterPosted.length, safeLimit),
  };
}

function decisionPoolRejectReason(work: CandidateWork, decisionType: Exclude<DecisionType, "UNKNOWN">): DecisionSupplyRejectReason | null {
  return decisionFactEligibilityReason({
    currentPrice: currentPrice(work),
    recordedLowestPrice: work.lowest_price,
    isOnSale: activeSale(work),
    discountRate: work.discount_rate,
    ranking: work.ranking,
    reviewAverage: work.review_average,
    reviewCount: work.review_count,
  }, decisionType);
}

export function classifyDecisionPoolWork(input: {
  currentPrice: number | null;
  lowestPrice: number | null;
  isOnSale: boolean | null;
  discountRate: number | null;
  ranking: number | null;
  reviewAverage: number | null;
  reviewCount: number | null;
}, decisionType: Exclude<DecisionType, "UNKNOWN">): DecisionSupplyRejectReason | null {
  return decisionFactEligibilityReason({ ...input, recordedLowestPrice: input.lowestPrice, isOnSale: input.isOnSale ?? false }, decisionType);
}

function latestLogDays(workId: number, logs: XPostLog[]) {
  const latest = logs.find((log) => log.work_id === workId);
  return latest ? Math.max(0, Math.floor((Date.now() - new Date(latest.posted_at).getTime()) / DAY_MS)) : Infinity;
}

function selectWithDiversity(works: CandidateWork[], logs: XPostLog[], limit: number, seed: string) {
  const absoluteEligible = works.filter((work) => latestLogDays(work.id, logs) >= ABSOLUTE_COOLDOWN_DAYS);
  const cooldownDays = [14, 7, 3].find(
    (days) => absoluteEligible.filter((work) => latestLogDays(work.id, logs) >= days).length >= limit,
  ) ?? 3;
  const eligible = absoluteEligible
    .filter((work) => latestLogDays(work.id, logs) >= cooldownDays)
    .sort((a, b) => fnv1aHash(`${seed}:${a.id}`) - fnv1aHash(`${seed}:${b.id}`) || (b.score ?? 0) - (a.score ?? 0));
  const selected: CandidateWork[] = [];
  const makers = new Set<string>();
  const actresses = new Set<string>();
  for (const work of eligible) {
    const maker = work.maker?.trim() ?? "";
    const actress = work.actress?.split(/[,、/]/)[0]?.trim() ?? "";
    if ((maker && makers.has(maker)) || (actress && actresses.has(actress))) continue;
    selected.push(work);
    if (maker) makers.add(maker);
    if (actress) actresses.add(actress);
    if (selected.length >= limit) break;
  }
  for (const work of eligible) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.id === work.id)) selected.push(work);
  }
  return { selected, cooldownDays };
}

type CandidatePool = [XPostCandidate["category"], CandidateWork[]];
type SelectedCandidateGroup = {
  category: XPostCandidate["category"];
  decisionType: Exclude<DecisionType, "UNKNOWN"> | null;
  selected: CandidateWork[];
  cooldownDays: number;
};

async function fetchCandidateSourceResults(performance: AffiliatePerformanceRow[]) {
  const salesIds = performance.filter((row) => row.salesScoreBonus > 0).slice(0, 30).map((row) => row.workId);
  const base = () => supabaseAdmin.from("works").select(SELECT_COLUMNS).not("product_id", "is", null).neq("product_id", "");
  const saleSampleMovieCutoff = new Date().toISOString();
  const [dealResult, scoreResult, newResult, salesResult, hiddenGemResult, actressResult, genreResult, makerResult, seriesResult, judgmentResult, reviewGapResult, recordLowSupplyResult, highDiscountSupplyResult, hiddenValueSupplyResult, saleSampleMovieResult] = await Promise.all([
    base().eq("is_on_sale", true).gt("sale_price", 0).order("score", { ascending: false, nullsFirst: false }).limit(60),
    base().gt("score", 0).order("score", { ascending: false, nullsFirst: false }).order("review_count", { ascending: false, nullsFirst: false }).limit(80),
    base().eq("stage", "NEW").order("score", { ascending: false, nullsFirst: false }).limit(60),
    salesIds.length ? base().in("id", salesIds) : Promise.resolve({ data: [], error: null }),
    base().gt("ranking", 80).gt("review_count", 7).gt("discount_rate", 0).order("score", { ascending: false, nullsFirst: false }).limit(80),
    base().not("actress", "is", null).gt("score", 0).order("score", { ascending: false, nullsFirst: false }).limit(80),
    base().not("genre", "is", null).gt("score", 0).order("review_count", { ascending: false, nullsFirst: false }).limit(80),
    base().not("maker", "is", null).gt("score", 0).order("score", { ascending: false, nullsFirst: false }).limit(50),
    base().not("series", "is", null).gt("score", 0).order("score", { ascending: false, nullsFirst: false }).limit(50),
    base().eq("is_on_sale", true).gt("discount_rate", 0).lt("review_average", 4.2).order("discount_rate", { ascending: false, nullsFirst: false }).limit(40),
    base().gt("review_average", 4.6).lt("review_count", 20).order("ranking", { ascending: false, nullsFirst: false }).limit(40),
    // These are supply lanes, not classification shortcuts. The exact
    // Decision Facts are still built from the same price-series chart below.
    base().eq("is_bottom_price", true).order("score", { ascending: false, nullsFirst: false }).limit(300),
    base().eq("is_on_sale", true).gte("discount_rate", HIGH_DISCOUNT_THRESHOLD).order("discount_rate", { ascending: false, nullsFirst: false }).limit(2000),
    base()
      .eq("is_on_sale", true)
      .gte("discount_rate", HIDDEN_VALUE_MIN_DISCOUNT)
      .gte("review_average", HIDDEN_VALUE_MIN_REVIEW_AVERAGE)
      .gte("review_count", HIDDEN_VALUE_MIN_REVIEW_COUNT)
      .or("ranking.is.null,ranking.gte.9999")
      .order("score", { ascending: false, nullsFirst: false })
      .limit(2000),
    base()
      .eq("is_on_sale", true)
      .gt("sale_price", 0)
      .not("sample_movie_url", "is", null)
      .or(`sale_end_at.is.null,sale_end_at.gt.${saleSampleMovieCutoff}`)
      .order("discount_rate", { ascending: false, nullsFirst: false })
      .order("score", { ascending: false, nullsFirst: false })
      .limit(SALE_SAMPLE_MOVIE_WORK_LIMIT),
  ]);
  return {
    base,
    dealResult,
    scoreResult,
    newResult,
    salesResult,
    hiddenGemResult,
    actressResult,
    genreResult,
    makerResult,
    seriesResult,
    judgmentResult,
    reviewGapResult,
    recordLowSupplyResult,
    highDiscountSupplyResult,
    hiddenValueSupplyResult,
    saleSampleMovieResult,
  };
}

type CandidateSourceResults = Awaited<ReturnType<typeof fetchCandidateSourceResults>>;

function sourceErrors(sources: CandidateSourceResults) {
  return [sources.dealResult.error, sources.scoreResult.error, sources.newResult.error, sources.salesResult.error, sources.hiddenGemResult.error, sources.actressResult.error, sources.genreResult.error, sources.makerResult.error, sources.seriesResult.error, sources.judgmentResult.error, sources.reviewGapResult.error, sources.recordLowSupplyResult.error, sources.highDiscountSupplyResult.error, sources.hiddenValueSupplyResult.error, sources.saleSampleMovieResult.error]
    .filter(Boolean).map((error) => error?.message ?? "候補取得エラー");
}

function createCandidatePools(sources: CandidateSourceResults): CandidatePool[] {
  return [
    ["market_scan", (sources.dealResult.data ?? []) as unknown as CandidateWork[]],
    ["comparison_pick", (sources.dealResult.data ?? []) as unknown as CandidateWork[]],
    ["judgment_pick", (sources.judgmentResult.data ?? []) as unknown as CandidateWork[]],
    ["review_gap", (sources.reviewGapResult.data ?? []) as unknown as CandidateWork[]],
    ["discovery_gap", (sources.hiddenGemResult.data ?? []) as unknown as CandidateWork[]],
    ["today_buy", (sources.dealResult.data ?? []) as unknown as CandidateWork[]],
    ["today_discovery", (sources.hiddenGemResult.data ?? []) as unknown as CandidateWork[]],
    ["actress_best", (sources.actressResult.data ?? []) as unknown as CandidateWork[]],
    ["genre_best", (sources.genreResult.data ?? []) as unknown as CandidateWork[]],
    ["deal", (sources.dealResult.data ?? []) as unknown as CandidateWork[]],
    ["hidden_gem", (sources.hiddenGemResult.data ?? []) as unknown as CandidateWork[]],
    ["score", (sources.scoreResult.data ?? []) as unknown as CandidateWork[]],
    ["new", (sources.newResult.data ?? []) as unknown as CandidateWork[]],
    ["sales", (sources.salesResult.data ?? []) as unknown as CandidateWork[]],
    ["maker_best", (sources.makerResult.data ?? []) as unknown as CandidateWork[]],
    ["series_best", (sources.seriesResult.data ?? []) as unknown as CandidateWork[]],
  ];
}

function getCandidatePoolMetrics(pools: CandidatePool[], postedWorkIds: ReadonlySet<number>) {
  const sourcePoolTotal = pools.reduce((sum, [, works]) => sum + works.length, 0);
  const sourcePoolByCategory = Object.fromEntries(pools.map(([category, works]) => [category, works.length]));
  const postedExcluded = pools.reduce((sum, [, works]) => sum + works.filter((work) => postedWorkIds.has(work.id)).length, 0);
  const sourcePoolWorkIdsAfterPosted = new Set(pools.flatMap(([, works]) => works.filter((work) => !postedWorkIds.has(work.id)).map((work) => work.id)));
  return { sourcePoolTotal, sourcePoolByCategory, postedExcluded, sourcePoolWorkIdsAfterPosted };
}

function selectCandidateGroups(sources: CandidateSourceResults, pools: CandidatePool[], logs: XPostLog[], postedWorkIds: ReadonlySet<number>) {
  const eligibleWorks = (works: CandidateWork[]) => works.filter((work) => !postedWorkIds.has(work.id));
  const decisionPools: Array<{ decisionType: Exclude<DecisionType, "UNKNOWN">; works: CandidateWork[]; category: XPostCandidate["category"] }> = [
    { decisionType: "RECORD_LOW", works: (sources.recordLowSupplyResult.data ?? []).filter((work) => !decisionPoolRejectReason(work as unknown as CandidateWork, "RECORD_LOW")) as unknown as CandidateWork[], category: "comparison_pick" },
    { decisionType: "HIGH_DISCOUNT_NOT_LOW", works: (sources.highDiscountSupplyResult.data ?? []).filter((work) => !decisionPoolRejectReason(work as unknown as CandidateWork, "HIGH_DISCOUNT_NOT_LOW")) as unknown as CandidateWork[], category: "deal" },
    { decisionType: "HIDDEN_VALUE", works: (sources.hiddenValueSupplyResult.data ?? []).filter((work) => !decisionPoolRejectReason(work as unknown as CandidateWork, "HIDDEN_VALUE")) as unknown as CandidateWork[], category: "hidden_gem" },
  ];
  const decisionSelectedGroups: SelectedCandidateGroup[] = decisionPools.map((pool) => ({
    category: pool.category,
    decisionType: pool.decisionType,
    ...selectWithDiversity(eligibleWorks(pool.works), logs, 120, `${todayKey()}:decision:${pool.decisionType}`),
  }));
  const regularSelectedGroups: SelectedCandidateGroup[] = pools.map(([category, works]) => ({
    category,
    decisionType: null,
    ...selectWithDiversity(eligibleWorks(works), logs, ["deal", "hidden_gem", "today_buy", "today_discovery"].includes(category) ? 120 : 48, `${todayKey()}:${category}`),
  }));
  const selectedGroups = [...decisionSelectedGroups, ...regularSelectedGroups];
  const decisionSupply: Record<Exclude<DecisionType, "UNKNOWN">, DecisionSupplyDiagnostics> = {
    RECORD_LOW: { dbFetchedWorks: (sources.recordLowSupplyResult.data ?? []).length, dbRawWorks: decisionPools[0].works.length, afterPostedCooldown: decisionSelectedGroups[0].selected.length, chartEligible: 0, uniqueWorks: 0, creativeVariants: 0, qualityEligible: 0, selected: 0, persisted: 0, firstDropReasonCounts: {}, firstDropByWorkId: {} },
    HIGH_DISCOUNT_NOT_LOW: { dbFetchedWorks: (sources.highDiscountSupplyResult.data ?? []).length, dbRawWorks: decisionPools[1].works.length, afterPostedCooldown: decisionSelectedGroups[1].selected.length, chartEligible: 0, uniqueWorks: 0, creativeVariants: 0, qualityEligible: 0, selected: 0, persisted: 0, firstDropReasonCounts: {}, firstDropByWorkId: {} },
    HIDDEN_VALUE: { dbFetchedWorks: (sources.hiddenValueSupplyResult.data ?? []).length, dbRawWorks: decisionPools[2].works.length, afterPostedCooldown: decisionSelectedGroups[2].selected.length, chartEligible: 0, uniqueWorks: 0, creativeVariants: 0, qualityEligible: 0, selected: 0, persisted: 0, firstDropReasonCounts: {}, firstDropByWorkId: {} },
  };
  return { selectedGroups, decisionSupply };
}

function prepareCandidatePools(
  sources: CandidateSourceResults,
  logs: XPostLog[],
  postedWorkIds: ReadonlySet<number>,
) {
  const pools = createCandidatePools(sources);
  return {
    errors: sourceErrors(sources),
    pools,
    ...getCandidatePoolMetrics(pools, postedWorkIds),
    ...selectCandidateGroups(sources, pools, logs, postedWorkIds),
  };
}

type SaleSampleMovieSupply = ReturnType<typeof selectSaleSampleMovieWorks<CandidateWork>>;

async function fetchCandidateVideoSupply(
  base: CandidateSourceResults["base"],
  saleSampleMovieResult: CandidateSourceResults["saleSampleMovieResult"],
  postedWorkIds: ReadonlySet<number>,
  errors: string[],
) {
  const reviewedVideoAssets = await supabaseAdmin
    .from("x_media_assets")
    .select("work_id")
    .eq("account_handle", "hakkutsu_lab")
    // User-confirmed operations treat all official sample movies as postable
    // candidates. rights_status is bookkeeping here, not an eligibility gate.
    // Technical URL/fetch/quality and explicit posted/exclusion checks happen
    // later in the X Growth media pipeline.
    .eq("source_kind", "official_sample")
    .order("reviewed_at", { ascending: false })
    .limit(120);
  const reviewedVideoWorkIds = [...new Set(((reviewedVideoAssets.data ?? []) as Array<{ work_id: number | null }>).map((asset) => asset.work_id).filter((id): id is number => Number.isSafeInteger(id)))];
  const reviewedVideoWorks = reviewedVideoWorkIds.length
    ? await base().in("id", reviewedVideoWorkIds.filter((id) => !postedWorkIds.has(id)))
    : { data: [] as CandidateWork[], error: null };
  if (reviewedVideoWorks.error) errors.push(reviewedVideoWorks.error.message);

  const saleVideoSupply = selectSaleSampleMovieWorks(
    (saleSampleMovieResult.data ?? []) as unknown as CandidateWork[],
    postedWorkIds,
  );
  const saleVideoWorkIds = new Set(saleVideoSupply.works.map((work) => work.id));
  const videoSupplyWorks = [...new Map([
    ...saleVideoSupply.works,
    ...((reviewedVideoWorks.data ?? []) as unknown as CandidateWork[]).filter((work) => !postedWorkIds.has(work.id)),
  ].map((work) => [work.id, work])).values()];

  return { saleVideoSupply, saleVideoWorkIds, videoSupplyWorks };
}

function createCandidateDiagnostics(input: {
  sourcePoolTotal: number;
  sourcePoolByCategory: Record<string, number>;
  postedExcluded: number;
  sourcePoolWorkIdsAfterPosted: Set<number>;
  selectedWorkCount: number;
  saleVideoSupply: SaleSampleMovieSupply;
  decisionSupply: Record<Exclude<DecisionType, "UNKNOWN">, DecisionSupplyDiagnostics>;
}) {
  const { sourcePoolTotal, sourcePoolByCategory, postedExcluded, sourcePoolWorkIdsAfterPosted, selectedWorkCount, saleVideoSupply, decisionSupply } = input;
  return {
    sourcePoolTotal: sourcePoolTotal + saleVideoSupply.fetched,
    sourcePoolByCategory: { ...sourcePoolByCategory, sale_sample_movie: saleVideoSupply.fetched },
    postedExcluded: postedExcluded + saleVideoSupply.activeOfficial - saleVideoSupply.afterPosted,
    sourcePoolAfterPosted: new Set([...sourcePoolWorkIdsAfterPosted, ...saleVideoSupply.works.map((work) => work.id)]).size,
    selectedWorkCount,
    saleVideoSupply: {
      fetched: saleVideoSupply.fetched,
      activeOfficial: saleVideoSupply.activeOfficial,
      afterPosted: saleVideoSupply.afterPosted,
      selected: saleVideoSupply.selected,
    },
    decisionSupply,
  };
}

type CandidateFunnels = Awaited<ReturnType<typeof fetchXWorkFunnels>>;

async function fetchCandidateContext(works: CandidateWork[]) {
  const [history, funnels] = await Promise.all([
    fetchHistory(works.map((work) => work.product_id)),
    fetchXWorkFunnels(works.map((work) => work.id)),
  ]);
  const rowsByProduct = new Map<string, PriceHistoryRow[]>();
  for (const row of history) rowsByProduct.set(row.product_id, [...(rowsByProduct.get(row.product_id) ?? []), row]);
  return { rowsByProduct, funnels };
}

function createVideoSupplyCandidates(input: {
  works: CandidateWork[];
  saleVideoWorkIds: Set<number>;
  postedWorkIds: ReadonlySet<number>;
  rowsByProduct: Map<string, PriceHistoryRow[]>;
  funnels: CandidateFunnels;
  logs: XPostLog[];
}) {
  const { works, saleVideoWorkIds, postedWorkIds, rowsByProduct, funnels, logs } = input;
  const candidates: XPostCandidate[] = [];
  const used = new Set<number>();
  for (const work of works) {
    if (postedWorkIds.has(work.id)) continue;
    const chart = buildXPostPriceChart(currentPrice(work), rowsByProduct.get(work.product_id) ?? []);
    const candidate = makeCandidate(
      work,
      saleVideoWorkIds.has(work.id) ? "market_scan" : "comparison_pick",
      chart,
      0,
      funnels.get(work.id) ?? { pageViews: 0, fanzaClicks: 0, ctr: 0 },
      logs,
    );
    used.add(work.id);
    candidates.push(candidate);
  }
  return { candidates, used };
}

function recordDecisionSupplyDrop(
  entry: DecisionSupplyDiagnostics | null,
  reason: "weighted_length_exceeded" | "decision_type_mismatch",
  workId: number,
) {
  if (!entry) return;
  entry.firstDropReasonCounts[reason] = (entry.firstDropReasonCounts[reason] ?? 0) + 1;
  entry.firstDropByWorkId[String(workId)] = reason;
}

function createSelectedGroupCandidate(input: {
  work: CandidateWork;
  group: SelectedCandidateGroup;
  used: Set<number>;
  postedWorkIds: ReadonlySet<number>;
  decisionSupply: Record<Exclude<DecisionType, "UNKNOWN">, DecisionSupplyDiagnostics>;
  rowsByProduct: Map<string, PriceHistoryRow[]>;
  funnels: CandidateFunnels;
  logs: XPostLog[];
}) {
  const { work, group, used, postedWorkIds, decisionSupply, rowsByProduct, funnels, logs } = input;
  if (postedWorkIds.has(work.id)) return null;
  if (!group.decisionType && used.has(work.id)) return null;

  const decisionSupplyEntry = group.decisionType ? decisionSupply[group.decisionType] : null;
  const chart = buildXPostPriceChart(currentPrice(work), rowsByProduct.get(work.product_id) ?? []);
  if (!group.decisionType && (group.category === "deal" || group.category === "today_buy") && !chart?.hadPriceDrop) return null;

  const candidate = makeCandidate(
    work,
    group.category,
    chart,
    group.cooldownDays,
    funnels.get(work.id) ?? { pageViews: 0, fanzaClicks: 0, ctr: 0 },
    logs,
    group.decisionType ?? undefined,
  );
  if (candidate.weightedLength > 280) {
    recordDecisionSupplyDrop(decisionSupplyEntry, "weighted_length_exceeded", work.id);
    return null;
  }
  if (group.decisionType && !candidate.decisionFacts.eligibleDecisionTypes.includes(group.decisionType)) {
    recordDecisionSupplyDrop(decisionSupplyEntry, "decision_type_mismatch", work.id);
    return null;
  }
  return candidate;
}

function updateDecisionSupplyStats(
  group: SelectedCandidateGroup,
  candidate: XPostCandidate,
  candidates: XPostCandidate[],
  decisionSupply: Record<Exclude<DecisionType, "UNKNOWN">, DecisionSupplyDiagnostics>,
) {
  if (!group.decisionType || !candidate.decisionFacts.eligibleDecisionTypes.includes(group.decisionType)) return;
  const entry = decisionSupply[group.decisionType];
  entry.chartEligible += 1;
  entry.uniqueWorks = new Set(
    candidates
      .filter((item) => item.decisionFacts.decisionType === group.decisionType)
      .map((item) => item.workId),
  ).size;
}

function appendSelectedGroupCandidates(input: {
  groups: SelectedCandidateGroup[];
  candidates: XPostCandidate[];
  used: Set<number>;
  postedWorkIds: ReadonlySet<number>;
  decisionSupply: Record<Exclude<DecisionType, "UNKNOWN">, DecisionSupplyDiagnostics>;
  rowsByProduct: Map<string, PriceHistoryRow[]>;
  funnels: CandidateFunnels;
  logs: XPostLog[];
}) {
  const { groups, candidates, used, postedWorkIds, decisionSupply, rowsByProduct, funnels, logs } = input;
  for (const group of groups) {
    let groupCount = 0;
    for (const work of group.selected) {
      const candidate = createSelectedGroupCandidate({ work, group, used, postedWorkIds, decisionSupply, rowsByProduct, funnels, logs });
      if (!candidate) continue;
      used.add(work.id);
      candidates.push(candidate);
      updateDecisionSupplyStats(group, candidate, candidates, decisionSupply);
      groupCount += 1;
      if (groupCount >= 24 || candidates.length >= CANDIDATE_WORK_LIMIT) break;
    }
    if (candidates.length >= CANDIDATE_WORK_LIMIT) break;
  }
}

export function assembleXPostCandidatesFromSelections(input: {
  videoSupplyWorks: CandidateWork[];
  saleVideoWorkIds: Set<number>;
  selectedGroups: SelectedCandidateGroup[];
  postedWorkIds: ReadonlySet<number>;
  logs: XPostLog[];
  decisionSupply: Record<Exclude<DecisionType, "UNKNOWN">, DecisionSupplyDiagnostics>;
  rowsByProduct: Map<string, PriceHistoryRow[]>;
  funnels: CandidateFunnels;
}) {
  const { videoSupplyWorks, saleVideoWorkIds, selectedGroups, postedWorkIds, logs, decisionSupply, rowsByProduct, funnels } = input;
  const videoCandidates = createVideoSupplyCandidates({
    works: videoSupplyWorks,
    saleVideoWorkIds,
    postedWorkIds,
    rowsByProduct,
    funnels,
    logs,
  });
  appendSelectedGroupCandidates({
    groups: selectedGroups,
    candidates: videoCandidates.candidates,
    used: videoCandidates.used,
    postedWorkIds,
    decisionSupply,
    rowsByProduct,
    funnels,
    logs,
  });
  return videoCandidates.candidates.sort((a, b) => b.funnelScore - a.funnelScore);
}

async function buildXPostCandidatesFromSelections(input: {
  allSelected: CandidateWork[];
  videoSupplyWorks: CandidateWork[];
  saleVideoWorkIds: Set<number>;
  selectedGroups: SelectedCandidateGroup[];
  postedWorkIds: ReadonlySet<number>;
  logs: XPostLog[];
  decisionSupply: Record<Exclude<DecisionType, "UNKNOWN">, DecisionSupplyDiagnostics>;
}) {
  const { allSelected } = input;
  const { rowsByProduct, funnels } = await fetchCandidateContext(allSelected);
  return assembleXPostCandidatesFromSelections({ ...input, rowsByProduct, funnels });
}

export async function getXPostCandidates(
  performance: AffiliatePerformanceRow[],
  logs: XPostLog[] = [],
  postedWorkIds: ReadonlySet<number> = new Set(),
) {
  const sources = await fetchCandidateSourceResults(performance);
  const {
    errors,
    sourcePoolTotal,
    sourcePoolByCategory,
    postedExcluded,
    sourcePoolWorkIdsAfterPosted,
    selectedGroups,
    decisionSupply,
  } = prepareCandidatePools(sources, logs, postedWorkIds);
  const { base, saleSampleMovieResult } = sources;
  const videoSupplyResult = await fetchCandidateVideoSupply(base, saleSampleMovieResult, postedWorkIds, errors);
  const { saleVideoSupply, saleVideoWorkIds, videoSupplyWorks } = videoSupplyResult;
  const allSelected = [...new Map([
    ...videoSupplyWorks,
    ...selectedGroups.flatMap((group) => group.selected),
  ].map((work) => [work.id, work])).values()];
  const diagnostics = createCandidateDiagnostics({
    sourcePoolTotal,
    sourcePoolByCategory,
    postedExcluded,
    sourcePoolWorkIdsAfterPosted,
    selectedWorkCount: allSelected.length,
    saleVideoSupply,
    decisionSupply,
  });

  try {
    const candidates = await buildXPostCandidatesFromSelections({
      allSelected,
      videoSupplyWorks,
      saleVideoWorkIds,
      selectedGroups,
      postedWorkIds,
      logs,
      decisionSupply,
    });
    return {
      candidates: candidates.sort((a, b) => b.funnelScore - a.funnelScore),
      error: errors.length ? errors.join(" / ") : null,
      diagnostics,
    };
  } catch (error) {
    return {
      candidates: [],
      error: error instanceof Error ? error.message : "価格履歴を取得できませんでした",
      diagnostics,
    };
  }
}
