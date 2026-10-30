import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { myfansTextBigrams } from "@/lib/myfansTextBigrams";

type PastUsageRecord = {
  date: string;
  source: string;
  creatorKey: string;
  topicIdentity: string;
  topicSemanticKey: string;
  bodyFingerprint: string;
  actualPosted: boolean;
};

type PastUsageHelpers = {
  normalizeSourceUrl: (value: string | null | undefined) => string;
  normalizeBodyFingerprint: (value: string | null | undefined) => string;
  quoteUrlFromCandidate: (candidate: MyfansQuoteCandidate) => string;
  creatorKeyFromQuote: (candidate: MyfansQuoteCandidate) => string;
  creatorKeyFromProduct: (product: MyfansProduct) => string;
  topicSemanticKeyFor: (product: MyfansProduct, quote: MyfansQuoteCandidate, topicValue: null) => string;
  semanticTopicSimilarity: (left: string, right: string) => number;
};

type DailyPlanCandidate = Record<string, unknown>;
type DailyPlanSlot = Record<string, unknown>;

function bodySimilarityFromFingerprints(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftGrams = myfansTextBigrams(left);
  const rightGrams = myfansTextBigrams(right);
  return [...leftGrams].filter((gram) => rightGrams.has(gram)).length / Math.max(1, Math.min(leftGrams.size, rightGrams.size));
}

function quoteSourceIndex(analytics: MyfansAnalytics, helpers: PastUsageHelpers) {
  const quoteBySource = new Map<string, MyfansQuoteCandidate>();
  for (const quote of analytics.quoteCandidates) {
    quoteBySource.set(helpers.normalizeSourceUrl(quote.x_post_url), quote);
    quoteBySource.set(helpers.normalizeSourceUrl(helpers.quoteUrlFromCandidate(quote)), quote);
  }
  return quoteBySource;
}

function productById(analytics: MyfansAnalytics, productId: number | null | undefined) {
  return analytics.products.find((product) => product.id === productId);
}

function creatorKeyFromHistory(quote: MyfansQuoteCandidate | undefined, product: MyfansProduct | undefined, fallback = "", helpers: PastUsageHelpers) {
  if (quote) return helpers.creatorKeyFromQuote(quote);
  if (product) return helpers.creatorKeyFromProduct(product);
  return fallback;
}

function postTopicIdentity(quote: MyfansQuoteCandidate | undefined, productId: number | null | undefined, postType: string | null | undefined, strategy: string | null | undefined) {
  if (quote) return `quote:${quote.id}`;
  return productId ? `product:${productId}:${postType ?? ""}:${strategy ?? ""}` : "";
}

function postTopicSemanticKey(
  quote: MyfansQuoteCandidate | undefined,
  product: MyfansProduct | undefined,
  products: MyfansProduct[],
  productId: number | null | undefined,
  postType: string | null | undefined,
  strategy: string | null | undefined,
  helpers: PastUsageHelpers,
) {
  if (quote) return helpers.topicSemanticKeyFor(product ?? products[0] as MyfansProduct, quote, null);
  return productId ? `product:${productId}:${postType ?? ""}:${strategy ?? ""}` : "";
}

function postedHistoryRecord(post: MyfansAnalytics["posts"][number], planDate: string, analytics: MyfansAnalytics, quoteBySource: Map<string, MyfansQuoteCandidate>, helpers: PastUsageHelpers): PastUsageRecord | null {
  const date = (post.posted_at ?? post.created_at ?? "").slice(0, 10);
  if (!date || date >= planDate) return null;
  const source = helpers.normalizeSourceUrl(post.quote_x_url || post.source_x_url);
  const quote = quoteBySource.get(source);
  const product = productById(analytics, post.product_id);
  return {
    date,
    source,
    creatorKey: creatorKeyFromHistory(quote, product, "", helpers),
    topicIdentity: postTopicIdentity(quote, post.product_id, post.post_type, post.creative_strategy),
    topicSemanticKey: postTopicSemanticKey(quote, product, analytics.products, post.product_id, post.post_type, post.creative_strategy, helpers),
    bodyFingerprint: helpers.normalizeBodyFingerprint(post.body),
    actualPosted: post.status === "posted" || Boolean(post.posted_at || post.x_post_url),
  };
}

function postedHistoryRecords(analytics: MyfansAnalytics, planDate: string, quoteBySource: Map<string, MyfansQuoteCandidate>, helpers: PastUsageHelpers) {
  const records: PastUsageRecord[] = [];
  for (const post of analytics.posts) {
    const record = postedHistoryRecord(post, planDate, analytics, quoteBySource, helpers);
    if (record) records.push(record);
  }
  return records;
}

function planSelections(strategy: Record<string, unknown>) {
  const selections = strategy.daily_option_selection && typeof strategy.daily_option_selection === "object"
    ? strategy.daily_option_selection as Record<string, string>
    : {};
  const slots = Array.isArray(strategy.candidate_options) ? strategy.candidate_options as DailyPlanSlot[] : [];
  return { selections, slots };
}

function selectedCandidate(slot: DailyPlanSlot, selections: Record<string, string>): DailyPlanCandidate | undefined {
  const postOrder = String(slot.post_order ?? "");
  const selectedLabel = selections[postOrder] || String(slot.recommended_option ?? "A");
  const candidates = Array.isArray(slot.candidates) ? slot.candidates as DailyPlanCandidate[] : [];
  return candidates.find((candidate) => String(candidate.option_label ?? "A") === selectedLabel) ?? candidates[0];
}

function planTopicSemanticKey(selected: DailyPlanCandidate, quote: MyfansQuoteCandidate | undefined, product: MyfansProduct | undefined, products: MyfansProduct[], helpers: PastUsageHelpers) {
  if (quote) return helpers.topicSemanticKeyFor(product ?? products[0] as MyfansProduct, quote, null);
  return String(selected.topic_identity || "");
}

function plannedHistoryRecord(planDate: string, selected: DailyPlanCandidate, analytics: MyfansAnalytics, quoteBySource: Map<string, MyfansQuoteCandidate>, helpers: PastUsageHelpers): PastUsageRecord {
  const source = helpers.normalizeSourceUrl(String(selected.quote_x_url || selected.source_x_url || ""));
  const quote = quoteBySource.get(source);
  const productId = Number(selected.product_id ?? 0) || null;
  const product = productById(analytics, productId);
  return {
    date: planDate,
    source,
    creatorKey: creatorKeyFromHistory(quote, product, String(selected.creator ?? ""), helpers),
    topicIdentity: String(selected.topic_identity || (quote ? `quote:${quote.id}` : "")),
    topicSemanticKey: planTopicSemanticKey(selected, quote, product, analytics.products, helpers),
    bodyFingerprint: helpers.normalizeBodyFingerprint(String(selected.body ?? "")),
    actualPosted: false,
  };
}

function plannedHistoryRecords(analytics: MyfansAnalytics, planDate: string, quoteBySource: Map<string, MyfansQuoteCandidate>, helpers: PastUsageHelpers) {
  const records: PastUsageRecord[] = [];
  for (const plan of analytics.dailyPlans ?? []) {
    if (!plan.plan_date || plan.plan_date >= planDate) continue;
    const { selections, slots } = planSelections(plan.strategy_json ?? {});
    for (const slot of slots) {
      const selected = selectedCandidate(slot, selections);
      if (selected) records.push(plannedHistoryRecord(plan.plan_date, selected, analytics, quoteBySource, helpers));
    }
  }
  return records;
}

function latestRecord(records: PastUsageRecord[], predicate: (record: PastUsageRecord) => boolean) {
  return records.filter(predicate).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

function latestBodyRecord(records: PastUsageRecord[], body: string, helpers: PastUsageHelpers) {
  const fingerprint = helpers.normalizeBodyFingerprint(body);
  return latestRecord(records, (record) => Boolean(fingerprint) && (record.bodyFingerprint === fingerprint || bodySimilarityFromFingerprints(record.bodyFingerprint, fingerprint) >= 0.9));
}

function usageLookups(records: PastUsageRecord[], helpers: PastUsageHelpers) {
  return {
    latestSource: (source: string) => latestRecord(records, (record) => Boolean(source) && record.source === helpers.normalizeSourceUrl(source)),
    latestCreator: (creatorKey: string) => latestRecord(records, (record) => Boolean(creatorKey) && record.creatorKey === creatorKey),
    latestTopic: (topicIdentity: string, topicSemanticKey: string) => latestRecord(records, (record) =>
      Boolean(topicIdentity || topicSemanticKey) &&
      (record.topicIdentity === topicIdentity || helpers.semanticTopicSimilarity(record.topicSemanticKey, topicSemanticKey) >= 0.75)),
    latestBody: (body: string) => latestBodyRecord(records, body, helpers),
  };
}

export function buildMyfansPastUsageIndex(analytics: MyfansAnalytics, planDate: string, helpers: PastUsageHelpers) {
  const quoteBySource = quoteSourceIndex(analytics, helpers);
  const records = [
    ...postedHistoryRecords(analytics, planDate, quoteBySource, helpers),
    ...plannedHistoryRecords(analytics, planDate, quoteBySource, helpers),
  ];
  return { records, ...usageLookups(records, helpers) };
}
