import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";

export type MyfansQuoteCollectionTask = {
  id: string;
  creatorName: string;
  creatorXUrl: string;
  sourceXHandle: string;
  creatorId: number | null;
  productId: number | null;
  productTitle: string;
  instruction: string;
  collectedCount: number;
  topCandidates: Array<{ rank: number; xPostUrl: string; quoteUrl: string; mediaType: string; quoteVisualReady: boolean; urlKind: "media_permalink" | "status"; score: number; reason: string }>;
  topScore: number | null;
  globalRank: number | null;
  selectedForToday: boolean;
  lastCollectedAt: string | null;
  nextRefreshLabel: string;
  plannedSlot: string;
};

type QuoteCandidateRankRow = { candidate: MyfansQuoteCandidate };
type QuotePoolSummary = { global: QuoteCandidateRankRow[]; selected: QuoteCandidateRankRow[] };

export type MyfansQuoteCollectionTaskServices = {
  creatorKeyFromCreator: (creator: Pick<MyfansAnalytics["creators"][number], "id">) => string;
  creatorKeyFromQuote: (candidate: MyfansQuoteCandidate) => string;
  quoteUrlFromCandidate: (candidate: MyfansQuoteCandidate) => string;
  daysSinceIso: (value?: string | null) => number | null;
  addDaysIso: (value: string | null | undefined, days: number) => string | null;
  quoteMinScore: number;
  quoteRefreshDays: number;
};

type CreatorQuoteCollectionRow = {
  creator: MyfansAnalytics["creators"][number];
  product: MyfansProduct | null;
  creatorName: string;
  candidates: MyfansQuoteCandidate[];
};

function topCandidatesForCreator(candidates: MyfansQuoteCandidate[], services: MyfansQuoteCollectionTaskServices) {
  return candidates
    .filter((candidate) => (candidate.creator_rank ?? 99) <= 3 && candidate.score >= services.quoteMinScore)
    .sort((a, b) => (a.creator_rank ?? 99) - (b.creator_rank ?? 99) || b.score - a.score)
    .slice(0, 3)
    .map((candidate) => ({
      rank: candidate.creator_rank ?? 0,
      xPostUrl: candidate.x_post_url,
      quoteUrl: services.quoteUrlFromCandidate(candidate),
      mediaType: candidate.media_type ?? "none",
      quoteVisualReady: Boolean(candidate.quote_visual_ready),
      urlKind: (candidate.quote_visual_ready && candidate.media_permalink ? "media_permalink" : "status") as "media_permalink" | "status",
      score: candidate.score,
      reason: candidate.score_reason,
    }));
}

function creatorRefreshPriority(candidateCount: number, lastCollectedAt: string | null, services: MyfansQuoteCollectionTaskServices) {
  if (candidateCount < 5) return 100;
  const age = services.daysSinceIso(lastCollectedAt);
  if (age === null) return 80;
  return age >= services.quoteRefreshDays ? 60 + age : 0;
}

function summarizeCreatorQuotes(row: CreatorQuoteCollectionRow, services: MyfansQuoteCollectionTaskServices) {
  const topCandidates = topCandidatesForCreator(row.candidates, services);
  const lastCollectedAt = row.candidates
    .sort((a, b) => String(b.collected_at).localeCompare(String(a.collected_at)))[0]?.collected_at ?? null;
  return {
    ...row,
    topCandidates,
    lastCollectedAt,
    refreshPriority: creatorRefreshPriority(row.candidates.length, lastCollectedAt, services),
  };
}

function sourceXHandleForCreator(creator: CreatorQuoteCollectionRow["creator"]) {
  return (creator.source_x_handle ?? "").replace(/^@/, "") || creator.creator_x_url?.match(/x\.com\/([^/?#]+)/)?.[1] || "";
}

function globalRankForTopCandidate(
  topCandidates: ReturnType<typeof topCandidatesForCreator>,
  globalRankByUrl: Map<string, number>,
) {
  const topCandidate = topCandidates[0];
  return topCandidate ? globalRankByUrl.get(topCandidate.xPostUrl) ?? null : null;
}

function toCollectionTask(
  row: ReturnType<typeof summarizeCreatorQuotes>,
  globalRankByUrl: Map<string, number>,
  selectedUrls: Set<string>,
  services: MyfansQuoteCollectionTaskServices,
): MyfansQuoteCollectionTask {
  const { creator, product, creatorName, candidates, topCandidates, lastCollectedAt } = row;
  return {
    id: `quote-creator-${creator.id}`,
    creatorName,
    creatorXUrl: creator.creator_x_url ?? "",
    sourceXHandle: sourceXHandleForCreator(creator),
    creatorId: creator.id,
    productId: product?.id ?? null,
    productTitle: product?.title ?? "creator単位で収集",
    instruction: "creator本人のXプロフィールを開き、Companionで表示中の最新5-20件を収集します。投稿選択はシステムが行います。",
    collectedCount: candidates.length,
    topCandidates,
    topScore: topCandidates[0]?.score ?? null,
    globalRank: globalRankForTopCandidate(topCandidates, globalRankByUrl),
    selectedForToday: topCandidates.some((candidate) => selectedUrls.has(candidate.quoteUrl)),
    lastCollectedAt,
    nextRefreshLabel: services.addDaysIso(lastCollectedAt, services.quoteRefreshDays)?.slice(0, 10) ?? "未収集",
    plannedSlot: "次回の discovery_interest / profile_cta 枠",
  };
}

export function buildMyfansQuoteCollectionTasks(
  analytics: MyfansAnalytics,
  quotePool: QuotePoolSummary,
  services: MyfansQuoteCollectionTaskServices,
): MyfansQuoteCollectionTask[] {
  const globalRankByUrl = new Map(quotePool.global.map((row, index) => [row.candidate.x_post_url, index + 1]));
  const selectedUrls = new Set(quotePool.selected.map((row) => services.quoteUrlFromCandidate(row.candidate)));
  const productsByCreator = new Map<number, MyfansProduct[]>();
  for (const product of analytics.products) {
    if (!product.creator_id || product.status === "paused" || product.status === "rejected") continue;
    productsByCreator.set(product.creator_id, [...(productsByCreator.get(product.creator_id) ?? []), product]);
  }
  const rows = analytics.creators
    .filter((creator) => creator.is_active && creator.creator_x_url)
    .map((creator) => {
      const products = (productsByCreator.get(creator.id) ?? [])
        .sort((a, b) => (b.selection_score ?? 0) - (a.selection_score ?? 0));
      const product = products[0] ?? null;
      const key = services.creatorKeyFromCreator(creator);
      return {
        creator,
        product,
        creatorName: creator.display_name || creator.creator_x_url || "myfans creator",
        candidates: analytics.quoteCandidates.filter((candidate) => services.creatorKeyFromQuote(candidate) === key),
      };
    });
  return rows
    .map((row) => summarizeCreatorQuotes(row, services))
    .sort((a, b) => b.refreshPriority - a.refreshPriority || ((b.topCandidates[0]?.score ?? 0) - (a.topCandidates[0]?.score ?? 0)))
    .slice(0, 3)
    .map((row) => toCollectionTask(row, globalRankByUrl, selectedUrls, services));
}
