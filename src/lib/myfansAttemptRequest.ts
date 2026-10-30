import type { MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { roleFor } from "@/lib/myfansCopyHelpers";
import type { DailyRole } from "@/lib/myfansTopicValue";
import { isRevenueTargetProduct } from "./myfansCandidateResolution";
import type { MyfansLinkStrategy, RotationItem } from "./myfansGrowthStrategy";

type AttemptRequestContext = {
  growthQuotePool: Array<{ candidate: MyfansQuoteCandidate }>;
  quoteBySlot: Map<string, MyfansQuoteCandidate>;
  resolverExactQuotes: MyfansQuoteCandidate[];
};

export function fallbackMyfansPostTypes(postType: string) {
  if (postType === "profile_cta") return ["profile_cta", "ranking_note", "comparison_review", "discovery_interest"];
  if (postType === "ranking_note") return ["ranking_note", "profile_cta", "comparison_review", "discovery_interest"];
  if (postType === "discovery_interest") return ["discovery_interest", "ranking_note", "profile_cta", "comparison_review"];
  if (postType === "reply_link_sales" || postType === "body_link_sales") return [postType, "profile_cta", "ranking_note", "comparison_review", "discovery_interest"];
  return [postType, "ranking_note", "profile_cta", "comparison_review", "discovery_interest"];
}

export function resolveMyfansAttemptRequest(
  context: AttemptRequestContext,
  item: Pick<RotationItem, "postType" | "linkStrategy">,
  index: number,
  attempt: number,
  forcedQuote: MyfansQuoteCandidate | null,
) {
  const requestedPostType = postTypeForAttempt(item.postType, attempt);
  const requestedRole = roleForPostType(requestedPostType);
  const requestedLinkStrategy = linkStrategyForRole(requestedRole, item.linkStrategy);
  const needsAffiliateUrl = requiresAffiliateUrl(requestedLinkStrategy);
  const directGrowthQuote = directGrowthQuoteFor(context, {
    forcedQuote,
    index,
    attempt,
    needsAffiliateUrl,
    requestedPostType,
  });

  return { requestedPostType, requestedLinkStrategy, needsAffiliateUrl, directGrowthQuote };
}

function postTypeForAttempt(postType: string, attempt: number) {
  const fallbackPostTypes = fallbackMyfansPostTypes(postType);
  return fallbackPostTypes[attempt % fallbackPostTypes.length];
}

function roleForPostType(postType: string): DailyRole {
  if (postType === "reply_link_sales" || postType === "body_link_sales") return "REVENUE";
  return roleFor(postType, "no_link", "text_only");
}

function linkStrategyForRole(role: DailyRole, fallback: MyfansLinkStrategy): MyfansLinkStrategy {
  if (role === "REVENUE") return fallback;
  return role === "AUTHORITY" ? "profile_cta" : "no_link";
}

function requiresAffiliateUrl(linkStrategy: MyfansLinkStrategy) {
  return linkStrategy === "body_link" || linkStrategy === "reply_link";
}

function directGrowthQuoteFor(
  context: AttemptRequestContext,
  input: {
    forcedQuote: MyfansQuoteCandidate | null;
    index: number;
    attempt: number;
    needsAffiliateUrl: boolean;
    requestedPostType: string;
  },
) {
  const { forcedQuote, index, attempt, needsAffiliateUrl, requestedPostType } = input;
  if (needsAffiliateUrl || requestedPostType !== "discovery_interest") return null;

  return forcedQuote
    ?? (attempt === 0 ? context.resolverExactQuotes[index % Math.max(1, context.resolverExactQuotes.length)] : null)
    ?? (attempt === 0 ? context.quoteBySlot.get(`${requestedPostType}:${index}`) : null)
    ?? context.growthQuotePool[(index + attempt) % Math.max(1, context.growthQuotePool.length)]?.candidate
    ?? null;
}

type PostingRouteInput = {
  item: RotationItem;
  product: MyfansProduct | null;
  needsAffiliateUrl: boolean;
  requestedPostType: string;
  requestedLinkStrategy: MyfansLinkStrategy;
};

export function resolveMyfansPostingRoute(input: PostingRouteInput) {
  const hasRevenueTarget = Boolean(input.product && isRevenueTargetProduct(input.product));
  const needsNoRevenueRecovery = input.needsAffiliateUrl && !hasRevenueTarget;
  if (needsNoRevenueRecovery) return noRevenueRecoveryRoute(input.item);
  return requestedPostingRoute(input, hasRevenueTarget);
}

function noRevenueRecoveryRoute(item: RotationItem) {
  return {
    hasRevenueTarget: false,
    linkStrategy: "no_link" as const,
    objective: "impression" as const,
    postType: "discovery_interest",
    cta: "保存用の発見メモ",
    role: `${item.role} / myfans送客先不足のためリンクなし運用`,
  };
}

function requestedPostingRoute(input: PostingRouteInput, hasRevenueTarget: boolean) {
  const { item, requestedPostType, requestedLinkStrategy } = input;
  return {
    hasRevenueTarget,
    linkStrategy: requestedLinkStrategy,
    objective: item.objective,
    postType: requestedPostType,
    cta: item.cta,
    role: requestedRoleLabel(item, requestedPostType),
  };
}

function requestedRoleLabel(item: RotationItem, requestedPostType: string) {
  return requestedPostType === item.postType
    ? item.role
    : `${item.role} / ${item.postType}から${requestedPostType}へRecovery`;
}
