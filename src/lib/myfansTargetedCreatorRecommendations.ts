import { evaluateMyfansSourceValue } from "./myfansSourceValue";

type ProductRow = { creator_id: number | null };

type CreatorRow = {
  id: number;
  display_name: string | null;
  creator_x_url: string | null;
};

type QuoteRow = {
  creator_id: number;
  text_excerpt: string | null;
  posted_at: string | null;
  collected_at: string | null;
  media_type: "image" | "video" | "none" | null;
  media_permalink: string | null;
  quote_visual_ready: boolean | null;
  visual_analysis_status: "verified" | "partial" | "unavailable" | null;
  views: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  is_repost: boolean;
  is_reply: boolean;
  is_quote: boolean;
  last_used_at: string | null;
  cooldown_until: string | null;
};

type CollectionStateRow = {
  creator_id: number;
  last_processed_at: string | null;
  state: string | null;
};

export type TargetedCreatorRecommendation = {
  creatorId: number;
  displayName: string | null;
  creatorXUrl: string;
  productCount: number;
  need: string;
  eligible: boolean;
  lastCollectedAt: string | null;
  lastProcessedAt: string | null;
  collectionState: string;
};

export function normalizeXProfileUrl(value: unknown) {
  const raw = String(value ?? "").normalize("NFKC").trim().replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/?$/);
  return match ? `https://x.com/${match[1]}` : "";
}

function countProductsByCreator(products: ProductRow[]) {
  const counts = new Map<number, number>();
  for (const product of products) {
    if (!Number.isSafeInteger(product.creator_id)) continue;
    const creatorId = Number(product.creator_id);
    counts.set(creatorId, (counts.get(creatorId) ?? 0) + 1);
  }
  return counts;
}

function hasFreshPassSource(quote: QuoteRow) {
  const ageSource = quote.posted_at ?? quote.collected_at;
  const age = ageSource ? (Date.now() - new Date(ageSource).getTime()) / 86_400_000 : null;
  const source = evaluateMyfansSourceValue({
    text: quote.text_excerpt ?? "",
    postedAt: quote.posted_at,
    collectedAt: quote.collected_at,
    mediaType: quote.media_type,
    mediaPermalink: quote.media_permalink,
    quoteVisualReady: quote.quote_visual_ready,
    visualAnalysisStatus: quote.visual_analysis_status,
    views: quote.views,
    likes: quote.likes,
    reposts: quote.reposts,
    replies: quote.replies,
    isRepost: quote.is_repost,
    isReply: quote.is_reply,
    isQuote: quote.is_quote,
  });
  return !quote.is_repost && !quote.last_used_at && !quote.cooldown_until && age !== null && age <= 14 && source.verdict === "PASS";
}

function findFreshPassCreators(quotes: QuoteRow[]) {
  const creators = new Set<number>();
  for (const quote of quotes) {
    if (hasFreshPassSource(quote)) creators.add(Number(quote.creator_id));
  }
  return creators;
}

function findLatestCollectedAt(quotes: QuoteRow[]) {
  const latest = new Map<number, string>();
  for (const quote of quotes) {
    const creatorId = Number(quote.creator_id);
    const current = latest.get(creatorId);
    if (!current || String(quote.collected_at) > current) latest.set(creatorId, String(quote.collected_at));
  }
  return latest;
}

function recommendationAgeDays(value: string | null | undefined) {
  return value ? Math.max(0, (Date.now() - new Date(value).getTime()) / 86_400_000) : null;
}

function recommendationPriority(row: TargetedCreatorRecommendation) {
  const age = recommendationAgeDays(row.lastCollectedAt) ?? recommendationAgeDays(row.lastProcessedAt);
  if (age === null) return 3000;
  if (age >= 14) return 2500 + age;
  if (age >= 3) return 2000 + age;
  if (row.collectionState === "TEMP_ERROR" || row.collectionState === "THREAD_INCOMPLETE") return 1800 + age;
  return 1000 + age;
}

function isRecommendationEligible(row: TargetedCreatorRecommendation) {
  return Boolean(row.creatorXUrl && row.eligible && row.collectionState !== "PRIVATE" && row.collectionState !== "NO_POSTS");
}

function compareRecommendations(a: TargetedCreatorRecommendation, b: TargetedCreatorRecommendation) {
  return recommendationPriority(b) - recommendationPriority(a) || b.productCount - a.productCount || a.creatorId - b.creatorId;
}

export function buildTargetedCreatorRecommendations(input: {
  products: ProductRow[];
  creators: CreatorRow[];
  quotes: QuoteRow[];
  collectionStates: CollectionStateRow[];
}) {
  const productCount = countProductsByCreator(input.products);
  const freshPassCreators = findFreshPassCreators(input.quotes);
  const latestCollectedAt = findLatestCollectedAt(input.quotes);
  const stateByCreator = new Map(input.collectionStates.map((state) => [Number(state.creator_id), state]));
  const candidates = input.creators
    .map((creator) => ({
      creatorId: creator.id,
      displayName: creator.display_name,
      creatorXUrl: normalizeXProfileUrl(creator.creator_x_url),
      productCount: productCount.get(creator.id) ?? 0,
      need: freshPassCreators.has(creator.id) ? "既存fresh sourceあり。再収集不要" : "既存productにfresh Source Value PASSなし",
      eligible: !freshPassCreators.has(creator.id),
      lastCollectedAt: latestCollectedAt.get(creator.id) ?? null,
      lastProcessedAt: stateByCreator.get(creator.id)?.last_processed_at ?? null,
      collectionState: stateByCreator.get(creator.id)?.state ?? "ELIGIBLE",
    }))
    .filter(isRecommendationEligible)
    .sort(compareRecommendations)
    .slice(0, 5);
  return {
    candidates,
    reason: candidates.length ? "既存productにfresh sourceがないcreatorを最大5件選定" : "既存productにfresh source不足の対象なし",
  };
}
