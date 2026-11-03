import type { ExecutionCandidate } from "./MyfansExecutionBoardRules";
import { publishBody } from "./MyfansExecutionBoardRules";

function appendCoreCandidateFields(formData: FormData, candidate: ExecutionCandidate) {
  formData.set("action", "post");
  if (candidate.product) formData.set("product_id", String(candidate.product.id));
  formData.set("post_type", candidate.postType);
  formData.set("status", "ready");
  formData.set("body", publishBody(candidate));
  formData.set("self_reply", candidate.selfReply);
  formData.set("includes_pr", candidate.linkStrategy === "no_link" || candidate.linkStrategy === "profile_cta" ? "false" : "true");
  formData.set("quote_x_url", candidate.quoteXUrl || candidate.sourceXUrl);
  formData.set("source_x_url", candidate.sourceXUrl);
  formData.set("affiliate_url", candidate.affiliateUrl);
  formData.set("selection_reason", candidate.reason);
  if (candidate.quoteCandidateId) formData.set("quote_candidate_id", String(candidate.quoteCandidateId));
  if (candidate.product?.creator_id) formData.set("creator_id", String(candidate.product.creator_id));
  formData.set("growth_stage", candidate.growthStage);
  formData.set("link_strategy", candidate.linkStrategy);
  formData.set("cta_strategy", candidate.ctaStrategy);
  formData.set("creative_variant_id", candidate.creativeVariantId);
  formData.set("creative_strategy", candidate.creativeStrategy);
  formData.set("creative_reason", candidate.creativeReason);
}

function appendCandidateCardPayload(formData: FormData, candidate: ExecutionCandidate) {
  formData.set("card_payload", JSON.stringify({
    ...candidate.cardPayload,
    candidate_id: candidate.id,
    source_x_url: candidate.sourceXUrl,
    quote_x_url: candidate.quoteXUrl,
    quote_candidate_id: candidate.quoteCandidateId,
    creator_id: candidate.product?.creator_id ?? null,
    product_id: candidate.product?.id ?? null,
    objective: candidate.objective,
    creative_strategy: candidate.creativeStrategy,
    link_strategy: candidate.linkStrategy,
    attribution: {
      source_author: candidate.sourceAuthorLabel,
      source_media_type: candidate.sourceMediaType,
      approved_media_id: candidate.approvedMediaId,
    },
  }));
  formData.set("ogp_check_required", candidate.ogpCheckRequired ? "true" : "false");
}

function appendCandidateSourceMetadata(formData: FormData, candidate: ExecutionCandidate) {
  // Product-less discovery still has a real source post. Preserve its
  // identity so posted-state cooldown/exclusion can close the loop.
  formData.set("quote_x_url", candidate.quoteXUrl || candidate.sourceXUrl);
  formData.set("media_permission_status", candidate.mediaPermissionStatus);
  formData.set("planned_slot", candidate.plannedSlot);
  formData.set("objective", candidate.objective);
  if (candidate.marketPatternKey) formData.set("market_pattern_key", candidate.marketPatternKey);
  if (candidate.globalContentFingerprint) formData.set("global_content_fingerprint", candidate.globalContentFingerprint);
  formData.set("approved_media_name", candidate.approvedMediaName);
  if (candidate.approvedMediaId) formData.set("approved_media_id", String(candidate.approvedMediaId));
}

function appendCandidateOpportunityScores(formData: FormData, candidate: ExecutionCandidate) {
  formData.set("growth_score", String(candidate.opportunity?.growthScore ?? 0));
  formData.set("revenue_score", String(candidate.opportunity?.revenueScore ?? 0));
  formData.set("creator_ltv_score", String(candidate.opportunity?.creatorLtvScore ?? 0));
  formData.set("expected_reward_per_1000_impressions", String(candidate.opportunity?.expectedRewardPer1000Impressions ?? 0));
}

export function buildExecutionCandidateFormData(candidate: ExecutionCandidate) {
  const formData = new FormData();
  appendCoreCandidateFields(formData, candidate);
  appendCandidateCardPayload(formData, candidate);
  appendCandidateSourceMetadata(formData, candidate);
  appendCandidateOpportunityScores(formData, candidate);
  return formData;
}
