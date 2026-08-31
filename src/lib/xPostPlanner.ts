import type { AffiliatePerformanceRow } from "@/lib/affiliateSalesAnalytics";
import { calculateAdjustedCtr, calculateBuyTimingScore } from "@/lib/buyTiming";
import { normalizeDisplayName } from "@/lib/createChartData";
import { parseDatabaseDate } from "@/lib/dateTime";
import { calculateDiscoveryScore } from "@/lib/discoveryScore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildXCreativeVariants,
  calculateHookScore,
  type XCreativeVariant,
  type XHookScore,
  type XHookType,
  type XImageStrategy,
  type XLinkStrategy,
  type XCtaStrategy,
} from "@/lib/xCreativeEngine";
import type { XPostLog } from "@/lib/xPostLogs";
import { getXWeightedLength, truncateXText } from "@/lib/xText";

type CandidateWork = {
  id: number; product_id: string; title: string; actress: string | null; genre: string | null; maker: string | null; series: string | null;
  score: number | null; price: number | null; sale_price: number | null; list_price: number | null;
  discount_rate: number | null; review_average: number | null; review_count: number | null;
  ranking: number | null; lowest_price: number | null; release_date: string | null;
  stage: string | null; is_on_sale: boolean | null; sale_end_at: string | null;
};

type PriceHistoryRow = {
  product_id: string; changed_at: string; display_name: string; period: string | null;
  normal_price: number | null; sale_price: number | null;
};

export type XChartPoint = { changedAt: string; price: number };

export type XPostCandidate = {
  key: string;
  workId: number;
  productId: string;
  title: string;
  category: "sales" | "deal" | "score" | "new" | "hidden_gem" | "today_buy" | "today_discovery" | "actress_best" | "genre_best" | "maker_best" | "series_best";
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
};

const SELECT_COLUMNS = [
  "id", "product_id", "title", "actress", "maker", "score", "price", "sale_price",
  "genre", "series", "list_price", "discount_rate", "review_average", "review_count", "release_date", "stage",
  "ranking", "lowest_price", "is_on_sale", "sale_end_at",
].join(",");
const DAY_MS = 86_400_000;
const HISTORY_BATCH_SIZE = 20;
const HISTORY_PAGE_SIZE = 1000;
const ABSOLUTE_COOLDOWN_DAYS = 3;
const databaseDateTime = (value: string) => parseDatabaseDate(value)?.getTime() ?? Number.NaN;

type FunnelStat = {
  pageViews: number;
  fanzaClicks: number;
  ctr: number;
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hakkutsu-lab.com").replace(/\/$/, "");
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function activeSale(work: CandidateWork) {
  return Boolean(
    work.is_on_sale && work.sale_price && work.sale_price > 0 &&
    (!work.sale_end_at || (parseDatabaseDate(work.sale_end_at)?.getTime() ?? 0) > Date.now()),
  );
}

function currentPrice(work: CandidateWork) {
  if (activeSale(work)) return work.sale_price;
  return work.price && work.price > 0 ? work.price : null;
}

function effectivePrice(row: PriceHistoryRow) {
  return row.sale_price && row.sale_price > 0
    ? row.sale_price
    : row.normal_price && row.normal_price > 0 ? row.normal_price : null;
}

function chartForWork(work: CandidateWork, rows: PriceHistoryRow[]) {
  const livePrice = currentPrice(work);
  if (!livePrice) return null;
  const sorted = rows
    .map((row) => ({ ...row, value: effectivePrice(row) }))
    .filter((row): row is PriceHistoryRow & { value: number } => row.value !== null)
    .sort((a, b) => databaseDateTime(b.changed_at) - databaseDateTime(a.changed_at));
  const latestMatching = sorted.find((row) => row.value === livePrice);
  if (!latestMatching) return null;
  const seriesName = normalizeDisplayName(latestMatching.display_name);
  const seriesPeriod = latestMatching.period ?? null;
  const series = sorted
    .filter((row) => normalizeDisplayName(row.display_name) === seriesName && (row.period ?? null) === seriesPeriod)
    .sort((a, b) => databaseDateTime(a.changed_at) - databaseDateTime(b.changed_at));
  if (!series.length || series.at(-1)?.value !== livePrice) return null;

  const previousPrice = [...series].reverse().find((row) => row.value !== livePrice)?.value ?? null;
  const checkedAt = series.at(-1)?.changed_at ?? new Date().toISOString();
  const seriesPrices = series.map((row) => row.value);
  const seriesMinimumPrice = Math.min(...seriesPrices);
  const seriesMaximumPrice = Math.max(...seriesPrices);
  // Keep the same observations as the work-detail chart. Collapsing equal prices
  // changes the horizontal proportions and can make the mini chart tell a
  // different story even when both charts use the same price series.
  const points = series.slice(-8).map((row) => ({ changedAt: row.changed_at, price: row.value }));
  return {
    points: points.length >= 2 ? points : [
      { changedAt: checkedAt, price: livePrice },
      { changedAt: checkedAt, price: livePrice },
    ],
    previousPrice,
    hadPriceDrop: Boolean(previousPrice && previousPrice > livePrice),
    seriesName: latestMatching.display_name,
    seriesPeriod,
    seriesMinimumPrice,
    seriesMaximumPrice,
    seriesObservationCount: series.length,
    seriesStartedAt: series.at(0)?.changed_at ?? null,
    isNinetyDayLow: seriesMinimumPrice === livePrice && series.some((row) => row.value > livePrice),
    checkedAt,
  };
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
    .sort((a, b) => stableHash(`${seed}:${a.id}`) - stableHash(`${seed}:${b.id}`) || (b.score ?? 0) - (a.score ?? 0));
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

function makeCandidate(
  work: CandidateWork,
  category: XPostCandidate["category"],
  chart: ReturnType<typeof chartForWork>,
  cooldownDays: number,
  funnel: FunnelStat,
): XPostCandidate {
  const price = currentPrice(work);
  const regular = work.list_price && price && work.list_price > price
    ? work.list_price
    : chart?.previousPrice && price && chart.previousPrice > price ? chart.previousPrice : null;
  const discountRate = regular && price ? Math.round((1 - price / regular) * 100) : 0;
  const url = `${siteUrl()}/works/${work.id}?from=x&x_post=${encodeURIComponent(`${category}-${work.id}`)}`;
  const priceText = price ? `¥${price.toLocaleString("ja-JP")}` : "価格は詳細で確認";
  let label = "AI発掘";
  let reason = `発掘スコア${Math.round(work.score ?? 0)}点`;
  let selectionReason = `価格・評価・人気を分析。${cooldownDays}日間の作品重複を回避。`;
  let creativeKind: XPostCandidate["creativeKind"] = "discovery";
  let lines = ["【今日のAI発掘】", "「__TITLE__」", `${reason}。サンプルと価格を一緒に確認。`, url, "#PR #FANZA"];
  let discoveryScoreValue: number | null = null;
  let buyTimingScoreValue: number | null = null;

  if (category === "deal") {
    const rate = chart?.previousPrice && price ? Math.round((1 - price / chart.previousPrice) * 100) : discountRate;
    label = "価格アラート";
    reason = chart?.previousPrice && price
      ? `${chart.previousPrice.toLocaleString("ja-JP")}円 → ${price.toLocaleString("ja-JP")}円（${rate}%下落）`
      : `${discountRate}%OFF・${priceText}`;
    selectionReason = `同じ販売形式・期間の履歴で値下げを確認。${chart?.seriesName ?? "価格系列"}${chart?.seriesPeriod ? `（${chart.seriesPeriod}）` : ""}。`;
    creativeKind = "price-chart";
    lines = ["【価格アラート】", "「__TITLE__」", `${reason}。実際の価格推移をグラフで確認。`, url, "#PR #FANZA"];
  } else if (category === "new") {
    label = "新作発掘";
    reason = work.release_date ? `発売 ${work.release_date.slice(0, 10)}・${priceText}` : `新作・${priceText}`;
    selectionReason = `新作候補から日付固定で分散選出。${cooldownDays}日間の作品重複を回避。`;
    lines = ["【新作を発掘】", "「__TITLE__」", `${reason}。まずサンプルで雰囲気を確認。`, url, "#PR #FANZA"];
  } else if (category === "sales") {
    label = "実績発掘";
    reason = `販売実績あり・${priceText}`;
    selectionReason = `実際の販売実績がある候補。${cooldownDays}日間の作品重複を回避。`;
    lines = ["【実際に選ばれた作品】", "「__TITLE__」", `${priceText}。迷ったときの比較候補に。`, url, "#PR #FANZA"];
  } else if (category === "hidden_gem" || category === "today_discovery") {
    const priceRows = (chart?.points ?? []).map((point) => ({
      normal_price: point.price,
      sale_price: null,
    }));
    const adjustedCtr = calculateAdjustedCtr(funnel.pageViews, funnel.fanzaClicks);
    const buyTiming = calculateBuyTimingScore({
      work,
      priceHistory: priceRows,
      funnel: {
        pageViews: funnel.pageViews,
        fanzaClicks: funnel.fanzaClicks,
        rawCtr: funnel.ctr,
        adjustedCtr: adjustedCtr.adjustedCtr,
        confidence: adjustedCtr.confidence,
      },
    });
    const discovery = calculateDiscoveryScore({
      work,
      priceHistory: priceRows,
      buyTimingScore: buyTiming.score,
      funnel: {
        pageViews: funnel.pageViews,
        fanzaClicks: funnel.fanzaClicks,
        rawCtr: funnel.ctr,
        adjustedCtr: adjustedCtr.adjustedCtr,
        confidence: adjustedCtr.confidence,
      },
    });
    discoveryScoreValue = discovery.score;
    buyTimingScoreValue = buyTiming.score;
    label = category === "today_discovery" ? "今日の発掘" : "値下げ×埋もれ名作";
    reason = `発掘指数${discovery.score}・買い時${buyTiming.score}`;
    selectionReason = `ランキング${work.ranking ?? "未取得"}位、評価${work.review_average?.toFixed(1) ?? "未取得"}、レビュー${work.review_count ?? 0}件。${discovery.reasons.slice(0, 2).join("。")}。`;
    creativeKind = chart?.hadPriceDrop ? "price-chart" : "discovery";
    lines = [
      category === "today_discovery" ? "【今日の発掘】" : "【値下げ×埋もれ名作】",
      "「__TITLE__」",
      `ランキング${work.ranking ?? "未取得"}位 / 評価${work.review_average?.toFixed(1) ?? "-"} / レビュー${work.review_count ?? 0}件`,
      `${discountRate}%OFF / 発掘指数${discovery.score} / 買い時${buyTiming.score}`,
      url,
      "#PR #FANZA",
    ];
  } else if (category === "today_buy") {
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
    buyTimingScoreValue = buyTiming.score;
    label = "今日の買い時";
    reason = `買い時${buyTiming.score}・${discountRate}%OFF・${priceText}`;
    selectionReason = `買い時スコアと価格条件で選出。${buyTiming.reasons.slice(0, 2).join("。")}。`;
    creativeKind = "price-chart";
    lines = ["【今日の買い時】", "「__TITLE__」", `${priceText} / ${discountRate}%OFF / 買い時${buyTiming.score}`, "価格とサンプルを見て判断できます。", url, "#PR #FANZA"];
  } else if (category === "actress_best" || category === "genre_best" || category === "maker_best" || category === "series_best") {
    const entityName = category === "actress_best" ? work.actress?.split(/[,、/]/)[0]?.trim()
      : category === "genre_best" ? work.genre?.split(/[,、/]/)[0]?.trim()
        : category === "maker_best" ? work.maker?.trim()
          : work.series?.trim();
    const entityLabel = category === "actress_best" ? "女優別おすすめ"
      : category === "genre_best" ? "ジャンル別おすすめ"
        : category === "maker_best" ? "メーカー別おすすめ"
          : "シリーズ別おすすめ";
    label = entityLabel;
    reason = `${entityName ?? "注目条件"}のおすすめ・評価${work.review_average?.toFixed(1) ?? "-"}・レビュー${work.review_count ?? 0}件`;
    selectionReason = `${entityName ?? "注目条件"}ページのBEST10導線に使う候補。作品重複を${cooldownDays}日間回避。`;
    lines = [
      `【${entityLabel}】`,
      entityName ? `${entityName}で探すなら候補に入れたい一本。` : "条件別で探すなら候補に入れたい一本。",
      "「__TITLE__」",
      `評価${work.review_average?.toFixed(1) ?? "-"} / レビュー${work.review_count ?? 0}件 / ${priceText}`,
      url,
      "#PR #FANZA",
    ];
  } else if (work.review_average && work.review_count) {
    reason = `評価${work.review_average.toFixed(1)}・レビュー${work.review_count}件`;
    lines = ["【今日のAI発掘】", "「__TITLE__」", `${reason}。評価だけでなく価格推移も確認。`, url, "#PR #FANZA"];
  }
  const funnelScore = buildFunnelScore(work, category, chart, funnel);
  const funnelReason = funnel.pageViews > 0
    ? `直近30日X流入 ${funnel.pageViews}PV / FANZA ${funnel.fanzaClicks}回 / CTR ${funnel.ctr}%。`
    : "X流入は未検証。初期データを取りにいく候補。";
  selectionReason = `${selectionReason} ${funnelReason}`;
  const legacyPostText = fitPost(lines, work.title);
  const hookScore = calculateHookScore({
    key: `${category}-${work.id}`,
    title: work.title,
    url,
    category,
    actress: work.actress,
    genre: work.genre,
    currentPrice: price,
    previousPrice: chart?.previousPrice ?? regular,
    discountRate,
    reviewAverage: work.review_average,
    reviewCount: work.review_count ?? 0,
    ranking: work.ranking,
    score: Math.round(work.score ?? 0),
    discoveryScore: discoveryScoreValue,
    buyTimingScore: buyTimingScoreValue,
    isNinetyDayLow: chart?.isNinetyDayLow ?? false,
  });
  const creativeVariants = buildXCreativeVariants({
    key: `${category}-${work.id}`,
    title: work.title,
    url,
    category,
    actress: work.actress,
    genre: work.genre,
    currentPrice: price,
    previousPrice: chart?.previousPrice ?? regular,
    discountRate,
    reviewAverage: work.review_average,
    reviewCount: work.review_count ?? 0,
    ranking: work.ranking,
    score: Math.round(work.score ?? 0),
    discoveryScore: discoveryScoreValue,
    buyTimingScore: buyTimingScoreValue,
    isNinetyDayLow: chart?.isNinetyDayLow ?? false,
  }, hookScore);
  const primaryVariant = creativeVariants.find((variant) => variant.weightedLength <= 280) ?? creativeVariants[0];
  const postText = primaryVariant?.bodyText ?? legacyPostText;
  return {
    key: `${category}-${work.id}`,
    workId: work.id,
    productId: work.product_id,
    title: work.title,
    category,
    label,
    reason,
    selectionReason,
    postText,
    weightedLength: getXWeightedLength(postText),
    currentPrice: price,
    previousPrice: chart?.previousPrice ?? null,
    discountRate,
    reviewAverage: work.review_average,
    reviewCount: work.review_count ?? 0,
    score: Math.round(work.score ?? 0),
    discoveryScore: discoveryScoreValue,
    buyTimingScore: buyTimingScoreValue,
    ranking: work.ranking,
    checkedAt: chart?.checkedAt ?? new Date().toISOString(),
    funnelScore,
    xPageViews: funnel.pageViews,
    xFanzaClicks: funnel.fanzaClicks,
    xCtr: funnel.ctr,
    seriesName: chart?.seriesName ?? null,
    seriesPeriod: chart?.seriesPeriod ?? null,
    chartPoints: chart?.points ?? [],
    seriesMinimumPrice: chart?.seriesMinimumPrice ?? null,
    seriesMaximumPrice: chart?.seriesMaximumPrice ?? null,
    seriesObservationCount: chart?.seriesObservationCount ?? 0,
    seriesStartedAt: chart?.seriesStartedAt ?? null,
    isNinetyDayLow: chart?.isNinetyDayLow ?? false,
    cooldownDays,
    creativeKind,
    hookScore,
    hookType: primaryVariant?.hookType ?? hookScore.bestHook.type,
    creativeVariantId: primaryVariant?.id ?? `${category}-${work.id}-legacy`,
    creativeVariants,
    imageStrategy: primaryVariant?.imageStrategy ?? "original_work_image",
    linkStrategy: primaryVariant?.linkStrategy ?? "body_link",
    ctaStrategy: primaryVariant?.ctaStrategy ?? "reason_cta",
    replyText: primaryVariant?.replyText ?? null,
  };
}

function buildFunnelScore(
  work: CandidateWork,
  category: XPostCandidate["category"],
  chart: ReturnType<typeof chartForWork>,
  funnel: FunnelStat,
) {
  const score = Math.max(0, work.score ?? 0);
  const reviewWeight = Math.min(Math.max(work.review_count ?? 0, 0), 200) / 20;
  const priceDropWeight = chart?.hadPriceDrop ? 18 : 0;
  const categoryWeight = category === "sales" ? 18 : category === "hidden_gem" || category === "today_discovery" ? 14 : category === "deal" || category === "today_buy" ? 12 : category === "score" || category === "actress_best" || category === "genre_best" ? 8 : 5;
  const ctrWeight = funnel.pageViews >= 3 ? Math.min(funnel.ctr * 1.8, 45) : 0;
  const clickWeight = Math.min(funnel.fanzaClicks * 6, 30);
  const explorationWeight = funnel.pageViews === 0 ? 6 : funnel.pageViews < 3 ? 3 : 0;
  return Math.round(score + reviewWeight + priceDropWeight + categoryWeight + ctrWeight + clickWeight + explorationWeight);
}

async function fetchXWorkFunnels(workIds: number[]) {
  const uniqueIds = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const empty = new Map<number, FunnelStat>();
  if (!uniqueIds.length) return empty;

  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const [viewResult, clickResult] = await Promise.all([
    supabaseAdmin
      .from("work_page_views")
      .select("work_id")
      .eq("source_page", "x")
      .in("work_id", uniqueIds)
      .gte("viewed_at", cutoff)
      .limit(50_000),
    supabaseAdmin
      .from("affiliate_clicks")
      .select("work_id")
      .eq("source_page", "x")
      .in("work_id", uniqueIds)
      .gte("clicked_at", cutoff)
      .limit(50_000),
  ]);

  const stats = new Map<number, FunnelStat>();
  for (const id of uniqueIds) stats.set(id, { pageViews: 0, fanzaClicks: 0, ctr: 0 });

  if (!viewResult.error) {
    for (const row of (viewResult.data ?? []) as Array<{ work_id: number }>) {
      const current = stats.get(row.work_id);
      if (current) current.pageViews += 1;
    }
  }

  if (!clickResult.error) {
    for (const row of (clickResult.data ?? []) as Array<{ work_id: number }>) {
      const current = stats.get(row.work_id);
      if (current) current.fanzaClicks += 1;
    }
  }

  for (const current of stats.values()) {
    current.ctr = current.pageViews > 0
      ? Math.round((current.fanzaClicks / current.pageViews) * 1000) / 10
      : 0;
  }

  return stats;
}

async function fetchHistory(productIds: string[]) {
  const since = new Date(Date.now() - 90 * DAY_MS).toISOString();
  const rows: PriceHistoryRow[] = [];
  for (let start = 0; start < productIds.length; start += HISTORY_BATCH_SIZE) {
    const ids = productIds.slice(start, start + HISTORY_BATCH_SIZE);
    for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("price_history")
        .select("product_id,changed_at,display_name,period,normal_price,sale_price")
        .in("product_id", ids)
        .gte("changed_at", since)
        .order("product_id", { ascending: true })
        .order("changed_at", { ascending: false })
        .range(offset, offset + HISTORY_PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as PriceHistoryRow[]));
      if (!data?.length || data.length < HISTORY_PAGE_SIZE) break;
    }
  }
  return rows;
}

export async function getXPostCandidates(performance: AffiliatePerformanceRow[], logs: XPostLog[] = []) {
  const salesIds = performance.filter((row) => row.salesCount > 0).slice(0, 30).map((row) => row.workId);
  const base = () => supabaseAdmin.from("works").select(SELECT_COLUMNS).not("product_id", "is", null).neq("product_id", "");
  const [dealResult, scoreResult, newResult, salesResult, hiddenGemResult, actressResult, genreResult, makerResult, seriesResult] = await Promise.all([
    base().eq("is_on_sale", true).gt("sale_price", 0).order("score", { ascending: false, nullsFirst: false }).limit(60),
    base().gt("score", 0).order("score", { ascending: false, nullsFirst: false }).order("review_count", { ascending: false, nullsFirst: false }).limit(80),
    base().eq("stage", "NEW").order("score", { ascending: false, nullsFirst: false }).limit(60),
    salesIds.length ? base().in("id", salesIds) : Promise.resolve({ data: [], error: null }),
    base().gt("ranking", 80).gt("review_count", 7).gt("discount_rate", 0).order("score", { ascending: false, nullsFirst: false }).limit(80),
    base().not("actress", "is", null).gt("score", 0).order("score", { ascending: false, nullsFirst: false }).limit(80),
    base().not("genre", "is", null).gt("score", 0).order("review_count", { ascending: false, nullsFirst: false }).limit(80),
    base().not("maker", "is", null).gt("score", 0).order("score", { ascending: false, nullsFirst: false }).limit(50),
    base().not("series", "is", null).gt("score", 0).order("score", { ascending: false, nullsFirst: false }).limit(50),
  ]);
  const errors = [dealResult.error, scoreResult.error, newResult.error, salesResult.error, hiddenGemResult.error, actressResult.error, genreResult.error, makerResult.error, seriesResult.error]
    .filter(Boolean).map((error) => error?.message ?? "候補取得エラー");
  const pools: Array<[XPostCandidate["category"], CandidateWork[]]> = [
    ["today_buy", (dealResult.data ?? []) as unknown as CandidateWork[]],
    ["today_discovery", (hiddenGemResult.data ?? []) as unknown as CandidateWork[]],
    ["actress_best", (actressResult.data ?? []) as unknown as CandidateWork[]],
    ["genre_best", (genreResult.data ?? []) as unknown as CandidateWork[]],
    ["deal", (dealResult.data ?? []) as unknown as CandidateWork[]],
    ["hidden_gem", (hiddenGemResult.data ?? []) as unknown as CandidateWork[]],
    ["score", (scoreResult.data ?? []) as unknown as CandidateWork[]],
    ["new", (newResult.data ?? []) as unknown as CandidateWork[]],
    ["sales", (salesResult.data ?? []) as unknown as CandidateWork[]],
    ["maker_best", (makerResult.data ?? []) as unknown as CandidateWork[]],
    ["series_best", (seriesResult.data ?? []) as unknown as CandidateWork[]],
  ];
  const selectedGroups = pools.map(([category, works]) => ({
    category,
    ...selectWithDiversity(works, logs, category === "deal" || category === "hidden_gem" || category === "today_buy" || category === "today_discovery" ? 24 : 8, `${todayKey()}:${category}`),
  }));
  const allSelected = [...new Map(selectedGroups.flatMap((group) => group.selected).map((work) => [work.id, work])).values()];

  try {
    const [history, funnels] = await Promise.all([
      fetchHistory(allSelected.map((work) => work.product_id)),
      fetchXWorkFunnels(allSelected.map((work) => work.id)),
    ]);
    const rowsByProduct = new Map<string, PriceHistoryRow[]>();
    for (const row of history) rowsByProduct.set(row.product_id, [...(rowsByProduct.get(row.product_id) ?? []), row]);
    const used = new Set<number>();
    const candidates: XPostCandidate[] = [];
    for (const group of selectedGroups) {
      let groupCount = 0;
      for (const work of group.selected) {
        if (used.has(work.id)) continue;
        const chart = chartForWork(work, rowsByProduct.get(work.product_id) ?? []);
        if ((group.category === "deal" || group.category === "today_buy") && !chart?.hadPriceDrop) continue;
        const candidate = makeCandidate(
          work,
          group.category,
          chart,
          group.cooldownDays,
          funnels.get(work.id) ?? { pageViews: 0, fanzaClicks: 0, ctr: 0 },
        );
        if (candidate.weightedLength > 280) continue;
        used.add(work.id);
        candidates.push(candidate);
        groupCount += 1;
        if (groupCount >= 4 || candidates.length >= 16) break;
      }
      if (candidates.length >= 16) break;
    }
    return {
      candidates: candidates.sort((a, b) => b.funnelScore - a.funnelScore),
      error: errors.length ? errors.join(" / ") : null,
    };
  } catch (error) {
    return { candidates: [], error: error instanceof Error ? error.message : "価格履歴を取得できませんでした" };
  }
}
