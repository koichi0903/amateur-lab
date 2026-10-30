import { daysBetweenDates } from "@/lib/myfansTime";
import { POSTED_SOURCE_COOLDOWN_DAYS, SELECTED_SOURCE_SOFT_COOLDOWN_DAYS, TOPIC_COOLDOWN_DAYS, buildMyfansQuotePool, buildPastUsageIndex, creatorKeyFromProduct, creatorKeyFromQuote, normalizeSourceUrl, quoteUrlFromCandidate, topicSemanticKeyFor, visualPriority } from "@/lib/myfansQuotePool";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { hasGroundedSourceText } from "@/lib/myfansTopicValue";

export type MyfansQuoteAttemptContext = {
  analytics: MyfansAnalytics;
  productionLinkageEvidence: MyfansAnalytics["productLinkageEvidence"];
  resolverExactQuotes: MyfansQuoteCandidate[];
  quoteBySlot: Map<string, MyfansQuoteCandidate>;
  quotePool: ReturnType<typeof buildMyfansQuotePool>;
  acceptedQuoteCreators: Set<string>;
  pastUsage: ReturnType<typeof buildPastUsageIndex>;
  planDate: string;
};

const SUPPORTED_QUOTE_POST_TYPES = new Set([
  "discovery_interest",
  "ranking_note",
  "profile_cta",
  "comparison_review",
  "reply_link_sales",
  "body_link_sales",
]);

function matchesProduct(product: MyfansProduct, candidate: MyfansQuoteCandidate) {
  return candidate.product_id === product.id || creatorKeyFromQuote(candidate) === creatorKeyFromProduct(product);
}

function quoteAllowedByHistory(candidate: MyfansQuoteCandidate, product: MyfansProduct, context: MyfansQuoteAttemptContext) {
  const sourceUsage = context.pastUsage.latestSource(candidate.x_post_url) ?? context.pastUsage.latestSource(quoteUrlFromCandidate(candidate));
  const sourceAge = sourceUsage ? daysBetweenDates(context.planDate, sourceUsage.date) : null;
  if (sourceUsage?.actualPosted && sourceAge !== null && sourceAge < POSTED_SOURCE_COOLDOWN_DAYS) return false;
  if (sourceUsage && sourceAge !== null && sourceAge < SELECTED_SOURCE_SOFT_COOLDOWN_DAYS) return false;
  const topicUsage = context.pastUsage.latestTopic(`quote:${candidate.id}`, topicSemanticKeyFor(product, candidate, null));
  const topicAge = topicUsage ? daysBetweenDates(context.planDate, topicUsage.date) : null;
  if (topicUsage && topicAge !== null && topicAge < TOPIC_COOLDOWN_DAYS) return false;
  return true;
}

function directSlotQuote(product: MyfansProduct, postType: string, index: number, attempt: number, context: MyfansQuoteAttemptContext) {
  const direct = attempt === 0 ? context.quoteBySlot.get(`${postType}:${index}`) : null;
  if (direct && quoteAllowedByHistory(direct, product, context) && (matchesProduct(product, direct) || postType === "discovery_interest")) return direct;
  return null;
}

function exactLinkageQuote(product: MyfansProduct, context: MyfansQuoteAttemptContext) {
  const exact = context.resolverExactQuotes.find((candidate) => context.productionLinkageEvidence.some((evidence) =>
    evidence.product_id === product.id && normalizeSourceUrl(evidence.source_status_url) === normalizeSourceUrl(candidate.x_post_url)));
  return exact && quoteAllowedByHistory(exact, product, context) && !exact.last_used_at ? exact : null;
}

function directProductQuote(product: MyfansProduct, attempt: number, context: MyfansQuoteAttemptContext) {
  if (attempt > 1) return null;
  return context.analytics.quoteCandidates
    .filter((candidate) => candidate.product_id === product.id && !candidate.last_used_at && quoteAllowedByHistory(candidate, product, context)
      && (visualPriority(candidate) >= 1 || (candidate.views ?? 0) >= 50_000 || hasGroundedSourceText(candidate)))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || b.score - a.score)[0] ?? null;
}

function unacceptedUsableQuote(candidate: MyfansQuoteCandidate, product: MyfansProduct, context: MyfansQuoteAttemptContext) {
  return !candidate.last_used_at
    && quoteAllowedByHistory(candidate, product, context)
    && (visualPriority(candidate) >= 1 || hasGroundedSourceText(candidate))
    && !context.acceptedQuoteCreators.has(creatorKeyFromQuote(candidate));
}

function productPoolQuote(product: MyfansProduct, attempt: number, context: MyfansQuoteAttemptContext) {
  if (attempt > 1) return null;
  return context.quotePool.global.find((row) => row.candidate.product_id === product.id
    && unacceptedUsableQuote(row.candidate, product, context))?.candidate ?? null;
}

function rotatedAvailableQuote(product: MyfansProduct, index: number, attempt: number, context: MyfansQuoteAttemptContext) {
  const available = context.quotePool.global.filter((row) => matchesProduct(product, row.candidate)
    && unacceptedUsableQuote(row.candidate, product, context));
  if (!available.length) return { found: false, candidate: null };
  return { found: true, candidate: available[(attempt + index) % available.length]?.candidate ?? null };
}

function verifiedBackupQuote(product: MyfansProduct, index: number, attempt: number, context: MyfansQuoteAttemptContext) {
  const verifiedBackup = context.analytics.quoteCandidates
    .filter((candidate) => matchesProduct(product, candidate) && unacceptedUsableQuote(candidate, product, context))
    .sort((a, b) => b.score - a.score || visualPriority(b) - visualPriority(a));
  return verifiedBackup[(attempt + index) % Math.max(1, verifiedBackup.length)] ?? null;
}

export function selectMyfansQuoteForAttempt(
  product: MyfansProduct | null,
  postType: string,
  index: number,
  attempt: number,
  context: MyfansQuoteAttemptContext,
) {
  if (!product || !SUPPORTED_QUOTE_POST_TYPES.has(postType)) return null;

  const direct = directSlotQuote(product, postType, index, attempt, context);
  if (direct) return direct;

  const exact = exactLinkageQuote(product, context);
  if (exact) return exact;

  const productSpecific = directProductQuote(product, attempt, context) ?? productPoolQuote(product, attempt, context);
  if (productSpecific) return productSpecific;
  const available = rotatedAvailableQuote(product, index, attempt, context);
  if (available.found) return available.candidate;
  return verifiedBackupQuote(product, index, attempt, context);
}
