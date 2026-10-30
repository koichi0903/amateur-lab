import { cleanText, cleanValidationStatus, cleanXMediaPermalink } from "@/lib/myfansCompanionInput";
import { canonicalMyfansXHandle } from "@/lib/myfansAuthorMatch";
import { scoreMyfansQuoteCandidate, type MyfansQuoteScanCandidate } from "@/lib/myfansQuoteScoring";
import { evaluateMyfansSourceValue } from "@/lib/myfansSourceValue";
import type { QuoteScanPayload } from "@/lib/myfansQuoteScanTypes";

type SingleStatusRecordInput = {
  approvedMediaId: number | null;
  candidate?: QuoteScanPayload["statusCandidate"];
  candidateUrl: string;
  creatorId: number;
  finalMyfansUrl: string;
  existingCandidate: Record<string, unknown> | null;
  product: Record<string, unknown> | null;
  productId: number | null;
  productResolutionMethod: string;
  resolvedEvidence: unknown[];
  sourceXHandle: string;
  text: string;
};

export function buildSingleStatusCandidateRecord(input: SingleStatusRecordInput) {
  const normalized = normalizeSingleStatusCandidate(input);
  const scored = scoreMyfansQuoteCandidate(normalized);
  const quoteVisualReady = isSingleStatusVisualReady(normalized);
  const sourceValue = evaluateSingleStatusSourceValue(normalized, quoteVisualReady);
  const record = {
    ...singleStatusIdentityFields(input),
    ...singleStatusVisualFields(normalized, quoteVisualReady),
    ...singleStatusMetricFields(normalized),
    ...singleStatusContentFields(normalized),
    ...singleStatusScoreFields(scored, sourceValue),
    ...singleStatusRankFields(scored),
  };
  return { normalized, scored, quoteVisualReady, record };
}

function normalizeSingleStatusCandidate(input: SingleStatusRecordInput): MyfansQuoteScanCandidate {
  const candidate = input.candidate;
  const rawMediaType = cleanText(candidate?.mediaType);
  return {
    ...candidate,
    xPostUrl: input.candidateUrl,
    sourceXHandle: input.sourceXHandle,
    text: input.text,
    mediaPermalink: cleanXMediaPermalink(candidate?.mediaPermalink),
    verifiedVideoPermalink: cleanXMediaPermalink(candidate?.verifiedVideoPermalink),
    generatedVideoPermalink: cleanXMediaPermalink(candidate?.generatedVideoPermalink),
    validationStatus: cleanValidationStatus(candidate?.validationStatus),
    mediaType: ["image", "video"].includes(rawMediaType) ? rawMediaType : "none",
    mediaCount: Math.max(0, Math.round(Number(candidate?.mediaCount ?? 0) || 0)),
    myfansUrls: singleStatusMyfansUrls(input.finalMyfansUrl),
    myfansLinkSource: normalizeSingleStatusLinkSource(candidate?.myfansLinkSource),
    resolvedProductEvidence: singleStatusResolvedEvidence(input),
    isReply: false,
  } as MyfansQuoteScanCandidate;
}

function singleStatusMyfansUrls(finalMyfansUrl: string) {
  return finalMyfansUrl ? [finalMyfansUrl] : [];
}

function normalizeSingleStatusLinkSource(value: unknown) {
  if (value === "own_reply") return "own_reply";
  if (value === "parent") return "parent";
  return null;
}

function singleStatusResolvedEvidence(input: SingleStatusRecordInput) {
  if (input.resolvedEvidence.length > 0) return input.resolvedEvidence;
  if (!input.finalMyfansUrl) return null;
  const postId = input.finalMyfansUrl.match(/\/posts\/([^/?#]+)/i)?.[1] || null;
  return [{ finalMyfansUrl: input.finalMyfansUrl, myfansPostUuid: postId, resolverMethod: input.productResolutionMethod, confidence: "exact" }];
}

function isSingleStatusVisualReady(candidate: MyfansQuoteScanCandidate) {
  const hasVerifiedVideo = candidate.mediaType === "video"
    && candidate.validationStatus === "verified_video_permalink"
    && candidate.verifiedVideoPermalink === candidate.mediaPermalink;
  const hasApprovedImage = candidate.mediaType === "image" && Boolean(candidate.quoteVisualReady);
  return Boolean(candidate.mediaPermalink && (hasVerifiedVideo || hasApprovedImage));
}

function evaluateSingleStatusSourceValue(candidate: MyfansQuoteScanCandidate, quoteVisualReady: boolean) {
  return evaluateMyfansSourceValue({
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
}

function singleStatusIdentityFields(input: SingleStatusRecordInput) {
  return {
    approved_media_id: input.approvedMediaId ?? input.existingCandidate?.approved_media_id ?? input.product?.approved_media_id ?? null,
    creator_id: input.creatorId,
    product_id: input.productId,
    creator_x_url: input.product?.creator_x_url || input.existingCandidate?.creator_x_url || `https://x.com/${canonicalMyfansXHandle(input.sourceXHandle)}`,
    source_x_handle: input.sourceXHandle,
    x_post_url: input.candidateUrl,
  };
}

function singleStatusVisualFields(candidate: MyfansQuoteScanCandidate, quoteVisualReady: boolean) {
  return {
    media_permalink: candidate.mediaPermalink || null,
    media_type: candidate.mediaType,
    media_count: candidate.mediaCount,
    quote_visual_ready: quoteVisualReady,
    media_permalink_verified_at: quoteVisualReady ? new Date().toISOString() : null,
    media_permalink_validation_status: candidate.validationStatus || null,
    visual_score: singleStatusVisualScore(candidate, quoteVisualReady),
  };
}

function singleStatusVisualScore(candidate: MyfansQuoteScanCandidate, quoteVisualReady: boolean) {
  if (!quoteVisualReady) return 0;
  return candidate.mediaType === "video" ? 100 : 85;
}

function singleStatusMetricFields(candidate: MyfansQuoteScanCandidate) {
  return {
    posted_at: candidate.postedAt || null,
    text_excerpt: candidate.text,
    views: candidate.views ?? null,
    likes: candidate.likes ?? null,
    reposts: candidate.reposts ?? null,
    replies: candidate.replies ?? null,
    bookmarks: candidate.bookmarks ?? null,
  };
}

function singleStatusContentFields(candidate: MyfansQuoteScanCandidate) {
  return {
    has_image: Boolean(candidate.hasImage),
    has_video: Boolean(candidate.hasVideo),
    is_pinned: Boolean(candidate.isPinned),
    is_reply: false,
    is_repost: Boolean(candidate.isRepost),
    is_quote: Boolean(candidate.isQuote),
  };
}

function singleStatusScoreFields(scored: ReturnType<typeof scoreMyfansQuoteCandidate>, sourceValue: ReturnType<typeof evaluateMyfansSourceValue>) {
  return {
    score: scored.score,
    score_reason: scored.reason,
    source_value_score: sourceValue.score,
    source_value_verdict: sourceValue.verdict,
    source_value_reasons: sourceValue.reasons,
    reaction_angles: sourceValue.reactionAngles,
    source_specificity: sourceValue.sourceSpecificity,
  };
}

function singleStatusRankFields(scored: ReturnType<typeof scoreMyfansQuoteCandidate>) {
  return {
    selected: false,
    creator_rank: scored.eligible ? 1 : null,
    global_score: scored.score,
    collected_at: new Date().toISOString(),
  };
}
