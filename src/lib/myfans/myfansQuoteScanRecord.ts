import { evaluateMyfansSourceValue } from "@/lib/myfansSourceValue";
import type { MyfansQuoteScanCandidate, MyfansQuoteScore } from "@/lib/myfansQuoteScoring";
import type { QuoteScanProduct } from "@/lib/myfans/myfansQuoteScanTypes";

type QuoteScanRecordInput = {
  approvedMediaId: number | null;
  approvedProduct: QuoteScanProduct | null;
  candidate: MyfansQuoteScanCandidate;
  creatorId: number;
  creatorXUrl: string;
  creatorRank: number;
  productId: number | null;
  result: MyfansQuoteScore;
  selected: boolean;
  sourceXHandle: string;
};

export function buildQuoteScanCandidateRecord(input: QuoteScanRecordInput) {
  const { candidate, result } = input;
  const visual = quoteScanVisualReadiness(candidate);
  return {
    ...recordIdentityFields(input),
    ...recordMediaFields(candidate, visual),
    ...recordMetricFields(candidate),
    ...recordPostTypeFields(candidate),
    score: result.score,
    score_reason: result.reason,
    ...sourceValueFields(candidate, visual.quoteVisualReady),
    ...selectionFields(input),
    ...threadLinkageFields(candidate),
  };
}

function quoteScanVisualReadiness(candidate: MyfansQuoteScanCandidate) {
  const isVerifiedVideo = candidate.mediaType === "video" && candidate.validationStatus === "verified_video_permalink" && candidate.verifiedVideoPermalink === candidate.mediaPermalink;
  const isVerifiedImage = candidate.mediaType === "image" && Boolean(candidate.mediaPermalink && candidate.quoteVisualReady);
  const quoteVisualReady = Boolean(candidate.mediaPermalink && (isVerifiedVideo || isVerifiedImage));
  return {
    quoteVisualReady,
    mediaPermalinkVerifiedAt: quoteVisualReady ? new Date().toISOString() : null,
    visualScore: visualScoreFor(candidate, quoteVisualReady),
  };
}

function visualScoreFor(candidate: MyfansQuoteScanCandidate, quoteVisualReady: boolean) {
  return quoteVisualReady
    ? candidate.mediaType === "video" ? 100 : candidate.mediaType === "image" ? 85 : 0
    : candidate.hasVideo || candidate.hasImage ? 25 : 0;
}

function recordIdentityFields(input: QuoteScanRecordInput) {
  return {
    approved_media_id: input.approvedMediaId ?? input.approvedProduct?.approved_media_id ?? null,
    creator_id: input.creatorId,
    product_id: input.productId,
    creator_x_url: input.creatorXUrl,
    source_x_handle: input.sourceXHandle,
    x_post_url: input.candidate.xPostUrl,
  };
}

function recordMediaFields(candidate: MyfansQuoteScanCandidate, visual: ReturnType<typeof quoteScanVisualReadiness>) {
  return {
    media_permalink: candidate.mediaPermalink || null,
    media_type: candidate.mediaType || "none",
    media_count: candidate.mediaCount ?? 0,
    quote_visual_ready: visual.quoteVisualReady,
    media_permalink_verified_at: visual.mediaPermalinkVerifiedAt,
    media_permalink_validation_status: candidate.validationStatus || null,
    visual_score: visual.visualScore,
  };
}

function recordMetricFields(candidate: MyfansQuoteScanCandidate) {
  return {
    posted_at: candidate.postedAt || null,
    text_excerpt: candidate.text || "",
    views: candidate.views ?? null,
    likes: candidate.likes ?? null,
    reposts: candidate.reposts ?? null,
    replies: candidate.replies ?? null,
    bookmarks: candidate.bookmarks ?? null,
  };
}

function recordPostTypeFields(candidate: MyfansQuoteScanCandidate) {
  return {
    has_image: Boolean(candidate.hasImage),
    has_video: Boolean(candidate.hasVideo),
    is_pinned: Boolean(candidate.isPinned),
    is_reply: Boolean(candidate.isReply),
    is_repost: Boolean(candidate.isRepost),
    is_quote: Boolean(candidate.isQuote),
  };
}

function sourceValueFields(candidate: MyfansQuoteScanCandidate, quoteVisualReady: boolean) {
  const sourceValue = evaluateMyfansSourceValue({
    text: candidate.text || "",
    postedAt: candidate.postedAt,
    collectedAt: new Date().toISOString(),
    mediaType: candidate.mediaType,
    mediaPermalink: candidate.mediaPermalink,
    quoteVisualReady,
    views: candidate.views,
    likes: candidate.likes,
    reposts: candidate.reposts,
    replies: candidate.replies,
    isRepost: candidate.isRepost,
    isReply: candidate.isReply,
    isQuote: candidate.isQuote,
  });
  return { source_value_score: sourceValue.score, source_value_verdict: sourceValue.verdict, source_value_reasons: sourceValue.reasons, reaction_angles: sourceValue.reactionAngles, source_specificity: sourceValue.sourceSpecificity };
}

function selectionFields(input: QuoteScanRecordInput) {
  return {
    selected: input.selected,
    creator_rank: input.creatorRank <= 3 && input.result.eligible ? input.creatorRank : null,
    global_score: input.result.score,
    collected_at: new Date().toISOString(),
  };
}

function threadLinkageFields(candidate: MyfansQuoteScanCandidate) {
  return {
    parent_status_url: candidate.parentStatusUrl || candidate.xPostUrl,
    parent_status_id: candidate.parentStatusId || candidate.xPostUrl.match(/\/status\/(\d+)/)?.[1] || null,
    own_reply_status_url: candidate.ownReplyStatusUrl || null,
    own_reply_status_id: candidate.ownReplyStatusId || null,
    myfans_link_source: candidate.myfansLinkSource || null,
    thread_collection_status: candidate.threadCollectionStatus || "LEGACY",
    collector_method: candidate.collectorMethod || "legacy_profile_scan",
    resolved_product_evidence: candidate.resolvedProductEvidence || {},
  };
}
