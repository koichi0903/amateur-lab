import { cardPayloadFor, inferAudience } from "@/lib/myfansCreativePlan";
import type { MyfansAnalytics, MyfansProduct, MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { quoteMatchesProduct, creatorMyfansUrl, type resolveMyfansCandidateProduct } from "./myfansCandidateResolution";
import { planningReasonFor, reasonFor } from "@/lib/myfansGrowthSummary";
import { reviewPublicCopyReaction } from "@/lib/myfansPublicCopyQuality";
import { replyFor } from "@/lib/myfansCopyHelpers";
import { whyAngleLine } from "@/lib/myfansPublicCopyGeneration";
import { quoteInsight, visualRenderStatus } from "@/lib/myfansCreativeEvidence";
import { audienceIntentFor, readerValueFor, stopReasonFor } from "@/lib/myfansCandidateCopy";
import type { MyfansCandidateBuildContext, MyfansCandidateCopyResult } from "./myfansCandidateBuilder";
import type { MyfansGrowthStage, MyfansLinkStrategy, MyfansObjective, RotationItem } from "./myfansGrowthStrategy";
import { stableHash } from "@/lib/myfansHash";

type CandidateRecordInput = {
  analytics: MyfansAnalytics;
  attempt: number;
  cta: string;
  creativeVariantId: string;
  copy: MyfansCandidateCopyResult;
  generatorVersion: string;
  hasRevenueTarget: boolean;
  index: number;
  item: RotationItem;
  learning: MyfansCandidateBuildContext["learning"];
  linkStrategy: MyfansLinkStrategy;
  multiAngleAttempt: number;
  needsAffiliateUrl: boolean;
  objective: MyfansObjective;
  postType: string;
  product: MyfansProduct | null;
  quoteProductMatched: boolean;
  resolution: ReturnType<typeof resolveMyfansCandidateProduct>;
  role: string;
  scored: ReturnType<MyfansCandidateBuildContext["pickProduct"]> | null;
  stage: MyfansGrowthStage;
  topicThreshold: number;
};

type QuoteOutputInput = Pick<CandidateRecordInput, "analytics" | "copy" | "product">;
type AttributionInput = Pick<CandidateRecordInput, "copy" | "product" | "resolution">;

export function buildMyfansCandidateRecord(input: CandidateRecordInput) {
  const { analytics, creativeVariantId, copy, item, linkStrategy, objective, postType, product, resolution, scored, stage, topicThreshold } = input;
  const { attention, body, copyAngle, copyInputHash, mediaPlan, publicCopyFacts, quality, reactionType, sourceSpecificity, topicIdentity, topicSemanticKey, topicValue, visualUnderstanding } = copy;
  const { candidateProduct, candidateType, candidateTitle, monetizableStatus, resolverEvidence, sourceAuthorHandle, sourceAuthorLabel } = resolution;

  return {
    id: creativeVariantId,
    product: candidateProduct,
    rankingContextProduct: product,
    body,
    publicCopyFacts,
    visualUnderstanding,
    ...candidateCopyFields(input),
    reactionType,
    copyAngle,
    multiAngleAttempt: input.multiAngleAttempt,
    generatorVersion: input.generatorVersion,
    copyInputHash,
    ...quoteOutputFields({ analytics, copy, product }),
    ...sourceOutputFields({ copy, product, resolution }),
    sourceAuthorHandle,
    sourceAuthorLabel,
    ...creatorOutputFields(input),
    ...sourceProductMatchOutputFields(input),
    resolverEvidence,
    candidateType,
    monetizableStatus,
    ...monetizationFields(input),
    sourceSpecificityScore: sourceSpecificity,
    candidateTitle,
    ...creativeOutputFields(input),
    growthStage: stage,
    postType,
    linkStrategy,
    ctaStrategy: input.cta,
    creativeVariantId,
    plannedSlot: item.slot,
    objective,
    role: input.role,
    ...reasonFields(input),
    opportunity: scored?.scores ?? null,
    ...productReasonFields(input),
    mediaPlan,
    ...mediaFields(input),
    attention,
    quality,
    topicValue,
    topicIdentity,
    topicSemanticKey,
    topicThreshold,
    ...readerFields(input),
    ...callToActionFields(input),
    assetRole: mediaPlan?.reason ?? "",
    ...postModeFields(input),
    ...affiliateTargetFields(input),
    creatorMyfansUrl: creatorMyfansUrl(candidateProduct),
    productMyfansUrl: candidateProduct?.product_url || "",
    ...affiliateConnectionFields(input),
    affiliateUrlGeneratedAt: candidateProduct?.affiliate_url_generated_at ?? null,
    affiliateUrlExpiresAt: candidateProduct?.affiliate_url_expires_at ?? null,
    affiliateUrlSource: candidateProduct?.affiliate_url_source ?? "",
  };
}

function candidateCopyFields(input: CandidateRecordInput) {
  const { body, quoteForSlot, visualUnderstanding, topicValue, reactionType, publicCopyFacts } = input.copy;
  const candidateProduct = input.resolution.candidateProduct;
  return {
    reactionReview: reviewPublicCopyReaction(body, quoteForSlot ?? null, visualUnderstanding),
    reasonToCare: topicValue?.reasonToCare ?? null,
    whyThisAngle: visualUnderstanding && reactionType && publicCopyFacts
      ? whyAngleLine(reactionType, visualUnderstanding, publicCopyFacts, input.attempt + input.index)
      : "",
    selfReply: candidateProduct ? replyFor(candidateProduct, input.linkStrategy) : "",
  };
}

function quoteOutputFields({ analytics, copy, product }: QuoteOutputInput) {
  const quote = copy.quoteForSlot;
  return {
    sourceXUrl: quote?.x_post_url || product?.source_x_url || "",
    quoteXUrl: copy.creative?.quoteXUrl ?? "",
    mediaPermalink: quote?.media_permalink || "",
    quoteCandidateId: quote?.id ?? null,
    marketPatternKey: analytics.selectedMediaId === 5 ? "QUOTE_HOOK" : null,
    globalContentFingerprint: analytics.selectedMediaId === 5 && quote
      ? `quote:${stableHash(`${quote.x_post_url}|${quote.text_excerpt}`)}`
      : null,
  };
}

function sourceOutputFields({ copy, product, resolution }: AttributionInput) {
  const quote = copy.quoteForSlot;
  return {
    sourceXStatusId: sourceXStatusIdFor(quote, product),
    sourceMediaType: sourceMediaTypeFor(quote),
    sourceCreator: sourceCreatorFields(quote, resolution.sourceAuthorHandle, resolution.sourceAuthorLabel),
  };
}

function sourceXStatusIdFor(quote: MyfansQuoteCandidate | null, product: MyfansProduct | null) {
  const sourceUrl = quote?.x_post_url || product?.source_x_url || "";
  return sourceUrl.match(/status\/(\d+)/)?.[1] ?? "";
}

function sourceMediaTypeFor(quote: MyfansQuoteCandidate | null) {
  if (!quote) return "none";
  return quote.media_type ?? (quote.has_video ? "video" : quote.has_image ? "image" : "none");
}

function sourceCreatorFields(quote: MyfansQuoteCandidate | null, handle: string, label: string) {
  const xUrl = quote?.creator_x_url || (handle ? `https://x.com/${handle}` : "");
  return { handle, label, xUrl };
}

function creatorOutputFields(input: CandidateRecordInput) {
  const { candidateProduct, canConnectProduct, myfansCreatorName, resolvedProduct } = input.resolution;
  return {
    myfansCreator: canConnectProduct && resolvedProduct?.creator_id ? {
      id: resolvedProduct.creator_id,
      name: myfansCreatorName,
      myfansUrl: creatorMyfansUrl(resolvedProduct),
      xUrl: resolvedProduct.creator_x_url || "",
    } : null,
    productCreator: candidateProduct?.creator_id ? {
      id: candidateProduct.creator_id,
      name: candidateProduct.myfans_creators?.display_name ?? "",
      xUrl: candidateProduct.creator_x_url || "",
    } : null,
  };
}

export function sourceProductMatchOutputFields(input: CandidateRecordInput) {
  const quote = input.copy.quoteForSlot;
  const { canConnectProduct, resolvedProduct, resolverEvidence } = input.resolution;
  if (!quote || !resolvedProduct) {
    return { sourceProductMatch: { matched: false, source: quote ? "unlinked" : "no_quote", confidence: "none" } };
  }
  const exactMatch = input.quoteProductMatched || quoteMatchesProduct(quote, resolvedProduct);
  return {
    sourceProductMatch: {
      matched: canConnectProduct,
      source: resolverEvidence?.resolution_method ?? (exactMatch ? "exact_id_or_handle" : "unlinked"),
      confidence: resolverEvidence?.confidence ?? (exactMatch ? "exact" : "none"),
    },
  };
}

function monetizationFields(input: CandidateRecordInput) {
  const { canConnectProduct, resolvedProduct, monetizableStatus } = input.resolution;
  return {
    affiliateUrl: canConnectProduct ? resolvedProduct?.affiliate_url ?? "" : "",
    affiliateStatus: monetizableStatus === "linked_affiliate_ready" ? "available" : monetizableStatus === "linked_no_affiliate" ? "missing" : "none",
    monetizable: monetizableStatus !== "unlinked",
  };
}

function creativeOutputFields(input: CandidateRecordInput) {
  const { candidateProduct } = input.resolution;
  const { creative, dailyRole } = input.copy;
  return {
    ...creativeStrategyFields(creative, dailyRole, candidateProduct, input.postType),
    ...approvedMediaFields(candidateProduct, input.analytics.selectedMediaId),
  };
}

function creativeStrategyFields(creative: CandidateRecordInput["copy"]["creative"], dailyRole: CandidateRecordInput["copy"]["dailyRole"], candidateProduct: MyfansProduct | null, postType: string) {
  const strategy = creative?.strategy ?? "text_only";
  return {
    creativeStrategy: strategy,
    dailyRole,
    creativeReason: creative?.reason ?? "",
    cardPayload: candidateProduct ? cardPayloadFor(candidateProduct, postType, strategy) : {},
    ogpCheckRequired: creative?.ogpCheckRequired ?? false,
  };
}

function approvedMediaFields(candidateProduct: MyfansProduct | null, selectedMediaId: number | null) {
  return {
    mediaPermissionStatus: candidateProduct?.media_permission_status ?? "unknown",
    approvedMediaName: candidateProduct?.approved_media_name || "@lumi_reviw",
    approvedMediaId: selectedMediaId === 5 ? 5 : candidateProduct?.approved_media_id ?? selectedMediaId ?? null,
  };
}

function reasonFields(input: CandidateRecordInput) {
  return {
    reason: input.needsAffiliateUrl && input.product && input.hasRevenueTarget && !input.product.affiliate_url
      ? "creator/productは紐付け済みです。正規アフィURL未作成のため、候補には残して作成導線を出します。"
      : reasonFor(input.stage, input.linkStrategy, input.objective),
    planningReason: planningReasonFor(input.stage, input.learning),
  };
}

function productReasonFields(input: CandidateRecordInput) {
  const candidateProduct = input.resolution.candidateProduct;
  if (!candidateProduct) return { productReason: "" };
  const reason = candidateProduct.selection_reason || input.scored?.scores.reason || reasonFor(input.stage, input.linkStrategy, input.objective);
  const noAffiliate = input.needsAffiliateUrl && input.hasRevenueTarget && !candidateProduct.affiliate_url;
  return {
    productReason: `${reason}${noAffiliate ? " 正規アフィURLなし。linked_no_affiliateとして候補に残します。" : ""}`,
  };
}

function mediaFields(input: CandidateRecordInput) {
  return {
    mediaPolicy: mediaPolicyFor(input.copy.quoteForSlot, input.copy.creative, input.copy.mediaPlan),
    ...audienceFields(input.postType, input.resolution.candidateProduct),
    ...hookFields(input.copy.hook),
  };
}

function mediaPolicyFor(quote: MyfansQuoteCandidate | null, creative: CandidateRecordInput["copy"]["creative"], mediaPlan: CandidateRecordInput["copy"]["mediaPlan"]) {
  if (!quote) return creative?.instruction ?? mediaPlan?.instruction ?? "";
  const instruction = creative?.instruction ?? "";
  const mediaType = quote.media_type ?? "none";
  const visualUrlType = quote.quote_visual_ready && quote.media_permalink ? "media_permalink" : "status";
  return `${instruction} media:${mediaType} / visual:${visualRenderStatus(quote)} / url:${visualUrlType} / ${quoteInsight(quote)} / ${quote.score_reason}`;
}

function audienceFields(postType: string, candidateProduct: MyfansProduct | null) {
  return {
    reader: candidateProduct ? inferAudience(candidateProduct) : "",
    audienceIntent: candidateProduct ? audienceIntentFor(postType, candidateProduct) : "broad_curiosity",
  };
}

function hookFields(hook: CandidateRecordInput["copy"]["hook"]) {
  return {
    hookType: hook?.hook ?? "COMPARISON",
    hookLabel: hook?.label ?? "根拠不足",
    hookEvidence: hook?.evidence ?? {},
  };
}

function readerFields(input: CandidateRecordInput) {
  const product = input.resolution.candidateProduct;
  return {
    readerValue: product ? readerValueFor(input.postType, product) : "",
    stopReason: product ? stopReasonFor(input.postType, product) : "",
  };
}

export function callToActionFields(input: CandidateRecordInput) {
  const { dailyRole } = input.copy;
  const { linkStrategy } = input;
  return {
    ctaRole: dailyRole === "REVENUE"
      ? "本文では売り込まず、確認したい人だけ正規リンクへ進ませる。"
      : linkStrategy === "profile_cta"
        ? "投稿単体で判断軸を出した後、過去比較を見る人だけプロフィールへ送る。"
        : linkStrategy === "reply_link"
          ? "本文では売り込まず、確認したい人だけ自己リプへ進ませる。"
          : "反応確認が目的なので、問いや共感で保存・返信のきっかけを作る。",
  };
}

function postModeFields(input: CandidateRecordInput) {
  const candidateProduct = input.resolution.candidateProduct;
  const creativeStrategy = input.copy.creative?.strategy;
  const replyAffiliate = creativeStrategy === "quote_post" && input.linkStrategy === "reply_link" && candidateProduct?.affiliate_url;
  return {
    postMode: replyAffiliate
      ? "quote_plus_reply_affiliate"
      : creativeStrategy === "quote_post"
        ? "quote"
        : input.linkStrategy === "body_link" || input.linkStrategy === "reply_link"
          ? "direct_affiliate"
          : "quote",
  };
}

function affiliateTargetFields(input: CandidateRecordInput) {
  const { resolverCanConnectProduct, resolvedProduct, myfansTarget } = input.resolution;
  const resolvedProductUrl = resolvedProduct?.product_url;
  return {
    affiliateTargetType: resolverCanConnectProduct && resolvedProductUrl ? "product" : myfansTarget.type,
    affiliateTargetUrl: resolverCanConnectProduct && resolvedProductUrl ? resolvedProductUrl : myfansTarget.url,
  };
}

function affiliateConnectionFields(input: CandidateRecordInput) {
  const { canConnectProduct, monetizableStatus, resolverEvidence } = input.resolution;
  return {
    affiliateConnectionStatus: canConnectProduct
      ? monetizableStatus
      : resolverEvidence?.confidence === "strong"
        ? "resolver_strong_needs_review"
        : "source_product_mismatch",
  };
}
