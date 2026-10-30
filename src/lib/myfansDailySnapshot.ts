import { MYFANS_PUBLIC_COPY_GENERATOR_VERSION, buildMyfansExecutionBoard } from "@/lib/myfansXExecution";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type MyfansExecutionBoard = ReturnType<typeof buildMyfansExecutionBoard>;
type MyfansDailyCandidate = MyfansExecutionBoard["candidates"][number];
type MyfansDailyCandidateOption = MyfansExecutionBoard["candidateOptions"][number]["candidates"][number];
type MyfansAttentionCandidate = MyfansExecutionBoard["quotePool"]["global"][number]["candidate"];

export type MyfansDailySnapshotResult = {
  id: number | null;
  status: "saved" | "existing" | "unavailable";
  message: string;
  postCount: number;
  planDate: string;
  planKey: string;
  revision: number | null;
  evaluatedAt: string | null;
  selectedOptions: Record<string, string>;
  errorCode?: string;
};

function visualStatusEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  const visual = candidate.visualUnderstanding;
  return {
    visual_understanding: visual,
    visual_analysis_status: visual?.visualAnalysisStatus ?? "unavailable",
    analyzer_version: visual?.analyzerVersion ?? null,
    visual_analysis_json: visual ?? null,
  };
}

function visualCueEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  const visual = candidate.visualUnderstanding;
  return {
    extracted_visual_cue: visual?.concreteVisualCue ?? "",
    raw_visual_evidence: visual?.rawVisualEvidence ?? "",
    human_observation: visual?.humanObservation ?? "",
    confidence: visual?.cueConfidence ?? "low",
  };
}

function visualSourceEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  const visual = candidate.visualUnderstanding;
  return {
    source_evidence: visual?.evidenceSource || visual?.sourceEvidence || "",
  };
}

function reactionCopyEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  const review = candidate.reactionReview;
  return {
    reaction_type: candidate.reactionType,
    reaction_review: review,
    natural_user_reaction: review?.naturalUserReaction ?? null,
    analyst_commentary_risk: review?.analystCommentaryRisk ?? null,
    source_specificity: review?.sourceSpecificity ?? candidate.sourceSpecificityScore,
  };
}

function topicCopyEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  const topicValue = candidate.topicValue;
  return {
    topic_value: topicValue,
    reason_to_care: topicValue?.reasonToCare ?? null,
  };
}

function publicCopyEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  return {
    body: candidate.body,
    self_reply: candidate.selfReply,
    generator_version: candidate.generatorVersion,
    copy_input_hash: candidate.copyInputHash,
    facts: candidate.publicCopyFacts,
    ...visualStatusEvidence(candidate),
    ...visualCueEvidence(candidate),
    ...visualSourceEvidence(candidate),
    ...reactionCopyEvidence(candidate),
    why_this_angle: candidate.whyThisAngle,
    ...topicCopyEvidence(candidate),
  };
}

function opportunityEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  const opportunity = candidate.opportunity;
  return {
    estimated_reward_per_1000_impressions: opportunity?.expectedRewardPer1000Impressions ?? null,
    revenue_score: opportunity?.revenueScore ?? null,
    growth_score: opportunity?.growthScore ?? null,
    creator_ltv_score: opportunity?.creatorLtvScore ?? null,
  };
}

function internalReasoningEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  return {
    why_selected: candidate.reason,
    quality_reason: candidate.quality.reasons,
    topic_value: candidate.topicValue,
    evidence: candidate.hookEvidence,
    validation_status: candidate.mediaPolicy,
    ...opportunityEvidence(candidate),
  };
}

function recoveryHistoryFor(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption, board: MyfansExecutionBoard) {
  return board.recovery.history.filter((row) => row.slot === candidate.plannedSlot);
}

export function snapshotEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption, board: MyfansExecutionBoard) {
  return {
    public_copy: publicCopyEvidence(candidate),
    internal_reasoning: internalReasoningEvidence(candidate),
    product_id: candidate.product?.id ?? null,
    ranking_context_product_id: candidate.rankingContextProduct?.id ?? null,
    quote_x_url: candidate.quoteXUrl,
    media_permalink: candidate.mediaPermalink,
    affiliate_url: candidate.affiliateUrl,
    source_x_url: candidate.sourceXUrl,
    source_author_handle: candidate.sourceAuthorHandle,
    source_creator: candidate.sourceCreator,
    myfans_creator: candidate.myfansCreator,
    product_creator: candidate.productCreator,
    source_product_match: candidate.sourceProductMatch,
    resolver_evidence: candidate.resolverEvidence,
    candidate_type: candidate.candidateType,
    monetizable_status: candidate.monetizableStatus,
    monetizable: candidate.monetizable,
    source_specificity_score: candidate.sourceSpecificityScore,
    candidate_title: candidate.candidateTitle,
    planned_slot: candidate.plannedSlot,
    objective: candidate.objective,
    link_strategy: candidate.linkStrategy,
    post_mode: candidate.postMode,
    affiliate_target_type: candidate.affiliateTargetType,
    affiliate_target_url: candidate.affiliateTargetUrl,
    affiliate_connection_status: candidate.affiliateConnectionStatus,
    creator_myfans_url: candidate.creatorMyfansUrl,
    product_myfans_url: candidate.productMyfansUrl,
    source_x_status_id: candidate.sourceXStatusId,
    source_media_type: candidate.sourceMediaType,
    affiliate_url_generated_at: candidate.affiliateUrlGeneratedAt,
    affiliate_url_expires_at: candidate.affiliateUrlExpiresAt,
    affiliate_url_source: candidate.affiliateUrlSource,
    creative_reason: candidate.creativeReason,
    media_policy: candidate.mediaPolicy,
    hook_label: candidate.hookLabel,
    hook_evidence: candidate.hookEvidence,
    attention: candidate.attention,
    quality: candidate.quality,
    topic_value: candidate.topicValue,
    recovery_history: recoveryHistoryFor(candidate, board),
    opportunity: candidate.opportunity,
    product_reason: candidate.productReason,
    reader_value: candidate.readerValue,
    stop_reason: candidate.stopReason,
    cta_role: candidate.ctaRole,
    asset_role: candidate.assetRole,
    card_payload: candidate.cardPayload,
  };
}

function visualRenderStatus(candidate: MyfansAttentionCandidate) {
  if (candidate.visual_render_status) return candidate.visual_render_status;
  const status = candidate.media_permalink_validation_status ?? "";
  if (candidate.media_type === "video" && /verified_video_permalink/.test(status)) return "browser_visible";
  if (candidate.media_type === "image" && candidate.quote_visual_ready && candidate.media_permalink) return "browser_visible";
  if (/not_rendered/i.test(status)) return "app_only";
  if (/blocked|sensitive|timeout|no_result/i.test(status)) return "blocked";
  return "unknown";
}

function persistedProductIdFor(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  if (candidate.monetizableStatus === "unlinked" || candidate.sourceProductMatch?.matched === false) return null;
  return candidate.product?.id ?? null;
}

function quoteCandidateIdFor(board: MyfansExecutionBoard, candidate: MyfansDailyCandidate | MyfansDailyCandidateOption) {
  const sourceUrl = candidate.quoteXUrl || candidate.sourceXUrl;
  return board.quotePool.global.find((row) =>
    sourceUrl && (row.candidate.x_post_url === sourceUrl || row.candidate.media_permalink === sourceUrl),
  )?.candidate.id ?? null;
}

function optionSelectionFields(board: MyfansExecutionBoard, index: number, option?: MyfansDailyCandidateOption) {
  const selectedOption = board.selectedOptions?.[String(index + 1)];
  const isSelected = option ? Boolean(selectedOption === option.optionLabel) : true;
  return {
    is_selected: isSelected,
    selected_at: option && selectedOption === option.optionLabel ? new Date().toISOString() : null,
  };
}

function optionIdentityFields(option?: MyfansDailyCandidateOption) {
  return {
    option_label: option?.optionLabel ?? "A",
    option_name: option?.optionName ?? "おすすめ",
    option_rank: option?.optionRank ?? 1,
  };
}

export function dailyPlanPostRecord(dailyPlanId: number, board: MyfansExecutionBoard, candidate: MyfansDailyCandidate | MyfansDailyCandidateOption, index: number, option?: MyfansDailyCandidateOption) {
  return {
    daily_plan_id: dailyPlanId,
    product_id: persistedProductIdFor(candidate),
    quote_candidate_id: quoteCandidateIdFor(board, candidate),
    post_order: index + 1,
    post_role: candidate.role,
    audience_intent: candidate.audienceIntent,
    hook_type: candidate.hookType,
    creative_strategy: candidate.creativeStrategy,
    quality_score: candidate.quality.total,
    quality_verdict: candidate.quality.verdict,
    evidence_json: snapshotEvidence(candidate, board),
    generator_version: candidate.generatorVersion,
    copy_input_hash: candidate.copyInputHash,
    body: candidate.body,
    self_reply: candidate.selfReply,
    ...optionIdentityFields(option),
    ...optionSelectionFields(board, index, option),
    novelty_json: option?.novelty ?? {},
  };
}

function dailyPlanOptionRecords(dailyPlanId: number, board: MyfansExecutionBoard) {
  if (board.candidateOptions?.length) {
    return board.candidateOptions.flatMap((slot, index) =>
      slot.candidates.map((candidate) => dailyPlanPostRecord(dailyPlanId, board, candidate, index, candidate)),
    );
  }
  return board.candidates.map((candidate, index) => dailyPlanPostRecord(dailyPlanId, board, candidate, index));
}

function candidateOptionProductSummary(candidate: MyfansDailyCandidateOption) {
  return {
    product_id: candidate.product?.id ?? null,
    ranking_context_product_id: candidate.rankingContextProduct?.id ?? null,
    product_title: candidate.product?.title ?? "",
  };
}

function candidateOptionSourceSummary(candidate: MyfansDailyCandidateOption) {
  const topicValue = candidate.topicValue;
  const visual = candidate.visualUnderstanding;
  return {
    reason_to_care: topicValue?.reasonToCare ?? null,
    visual_status: visual?.visualAnalysisStatus ?? "unavailable",
    visual_evidence: visual?.humanObservation || visual?.rawVisualEvidence || "",
  };
}

function candidateOptionValueSummary(candidate: MyfansDailyCandidateOption) {
  const novelty = candidate.novelty;
  return {
    topic_value: candidate.topicValue?.score ?? null,
    novelty,
    novelty_label: novelty?.label ?? null,
    same_source_status: novelty?.sameSourceLabel ?? null,
    last_same_source_date: novelty?.lastSameSourceDate ?? null,
    last_same_creator_date: novelty?.lastSameCreatorDate ?? null,
    past_body_similarity_label: novelty?.pastBodySimilarityLabel ?? null,
  };
}

function candidateOptionSummary(candidate: MyfansDailyCandidateOption) {
  return {
      id: candidate.id,
      option_label: candidate.optionLabel,
      option_name: candidate.optionName,
      body: candidate.body,
      self_reply: candidate.selfReply,
      source_x_url: candidate.sourceXUrl,
      quote_x_url: candidate.quoteXUrl,
      media_permalink: candidate.mediaPermalink,
      source_author_handle: candidate.sourceAuthorHandle,
      source_creator: candidate.sourceCreator,
      myfans_creator: candidate.myfansCreator,
      product_creator: candidate.productCreator,
      source_product_match: candidate.sourceProductMatch,
      resolver_evidence: candidate.resolverEvidence,
      candidate_type: candidate.candidateType,
      monetizable_status: candidate.monetizableStatus,
      monetizable: candidate.monetizable,
      source_specificity_score: candidate.sourceSpecificityScore,
      reaction_review: candidate.reactionReview,
      candidate_title: candidate.candidateTitle,
      ...candidateOptionProductSummary(candidate),
      role: candidate.dailyRole,
      post_type: candidate.postType,
      post_mode: candidate.postMode,
      link_strategy: candidate.linkStrategy,
      source_media_type: candidate.sourceMediaType,
      myfans_target_url: candidate.affiliateTargetUrl,
      affiliate_status: candidate.affiliateUrl ? "saved" : "missing",
      affiliate_connection_status: candidate.affiliateConnectionStatus,
      affiliate_url: candidate.affiliateUrl,
      creative_strategy: candidate.creativeStrategy,
      topic_identity: candidate.topicIdentity,
      ...candidateOptionSourceSummary(candidate),
      quality: candidate.quality.total,
      ...candidateOptionValueSummary(candidate),
      why_selected: candidate.reason,
  };
}

export function summarizeCandidateOptions(board: MyfansExecutionBoard) {
  return (board.candidateOptions ?? []).map((slot) => ({
    slot: slot.slot,
    post_order: slot.postOrder,
    recommended_option: slot.recommendedOption,
    candidates: slot.candidates.map(candidateOptionSummary),
  }));
}

function snapshotStrategyJson(board: MyfansExecutionBoard) {
  return {
    plan_key: board.planKey,
    day: board.day,
    stage: board.stage,
    strategy: board.strategy,
    today_strategy: board.todayStrategy,
    bottleneck: board.bottleneck,
    profile_funnel: board.profileFunnel,
    learning: board.learning,
    outbound_tasks: board.outboundTasks,
    held_candidates: board.heldCandidates,
    recovery: board.recovery,
    quote_candidate_funnel: board.quotePool.funnel,
    supply_funnel_audit: board.supplyAudit,
    linked_candidate_funnel: board.linkedCandidateFunnel,
    topic_value_funnel: board.topicValue.funnel,
    topic_value_top10: board.topicValue.top10,
    candidate_options: summarizeCandidateOptions(board),
    daily_option_selection: board.selectedOptions,
  };
}

function snapshotPostRows(board: MyfansExecutionBoard) {
  return dailyPlanOptionRecords(0, board).map((record) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== "daily_plan_id")),
  );
}

function snapshotAttentionRows(board: MyfansExecutionBoard) {
  return board.quotePool.global.slice(0, 10).map((row, index) => ({
    quote_candidate_id: row.candidate.id,
    product_id: row.candidate.product_id,
    attention_score: row.globalScore,
    score_json: { global_score: row.globalScore, source_score: row.candidate.score, rank: index + 1 },
    evidence_json: { visual_verified: row.candidate.quote_visual_ready, visual_render_status: visualRenderStatus(row.candidate), media_type: row.candidate.media_type, media_permalink: row.candidate.media_permalink, views: row.candidate.views, likes: row.candidate.likes, reposts: row.candidate.reposts, replies: row.candidate.replies, creator_rank: row.candidate.creator_rank, reason: row.candidate.score_reason },
  }));
}

function snapshotLinkageRows(board: MyfansExecutionBoard) {
  const linkageRows = [...board.candidates, ...(board.candidateOptions ?? []).flatMap((slot) => slot.candidates)]
    .map((candidate) => candidate.resolverEvidence)
    .filter((row): row is NonNullable<typeof row> => Boolean(row?.source_status_url && row.discovered_myfans_url && row.diagnostic_mode !== true))
    .map((row) => ({ approved_media_id: row.approved_media_id ?? null, quote_candidate_id: row.quote_candidate_id ?? null, source_status_url: row.source_status_url, source_author_handle: row.source_author_handle, discovered_myfans_url: row.discovered_myfans_url, final_myfans_url: row.final_myfans_url ?? null, product_id: row.product_id ?? null, resolution_method: row.resolution_method, confidence: row.confidence, evidence_source: row.evidence_source, verified_at: row.verified_at, metadata: row.metadata ?? {} }));
  const linkage = [...new Map(linkageRows.map((row) => [
    `${row.source_status_url}\u0000${row.discovered_myfans_url}\u0000${row.evidence_source}`,
    row,
  ])).values()];
  return linkage;
}

function snapshotOutboundRows(board: MyfansExecutionBoard) {
  return board.outboundTasks.map((task) => ({ task_type: task.type, target_url: task.targetUrl, reason: task.reason, suggested_text: task.suggestedText }));
}

export function dailySnapshotRpcArgs(board: MyfansExecutionBoard, approvedMediaId: number | null, evaluatedAt: string) {
  return {
    p_plan: {
      approved_media_id: approvedMediaId,
      plan_date: board.planDate,
      operation_day: board.day,
      stage: board.stage,
      plan_key: board.planKey,
      evaluated_at: evaluatedAt,
      strategy_json: { ...snapshotStrategyJson(board), daily_option_selection: board.selectedOptions },
      source_counts_json: board.quotePool.funnel,
    },
    p_posts: snapshotPostRows(board),
    p_attention: snapshotAttentionRows(board),
    p_linkage: snapshotLinkageRows(board),
    p_outbound: snapshotOutboundRows(board),
    p_audit: board.supplyAudit,
  };
}

function snapshotUnavailableResult(board: MyfansExecutionBoard, error: { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null) {
  const errorCode = typeof error?.code === "string" ? error.code : "RPC_EMPTY_RESULT";
  console.error("myfans daily snapshot RPC failed", {
    code: errorCode,
    message: typeof error?.message === "string" ? error.message : "invalid response",
    details: typeof error?.details === "string" ? error.details : undefined,
    hint: typeof error?.hint === "string" ? error.hint : undefined,
  });
  return { id: null, status: "unavailable", message: "Daily Planの保存に失敗しました。保存状態は変更されていません。時間をおいて再試行してください。", errorCode, postCount: 0, planDate: board.planDate, planKey: board.planKey, revision: null, evaluatedAt: null, selectedOptions: board.selectedOptions } as const;
}

export async function ensureMyfansDailySnapshot(board: MyfansExecutionBoard, approvedMediaId: number | null = board.candidates[0]?.approvedMediaId ?? null): Promise<MyfansDailySnapshotResult> {
  const evaluatedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin.rpc(
    "save_myfans_daily_snapshot",
    dailySnapshotRpcArgs(board, approvedMediaId, evaluatedAt),
  );
  if (error || !data?.plan_id) {
    return snapshotUnavailableResult(board, error);
  }
  const replaced = data.replaced === true;
  return { id: Number(data.plan_id), status: replaced ? "existing" : "saved", message: replaced ? "同日のDaily Planをatomicに再評価しました" : "今日のDaily Planを保存しました", postCount: board.candidates.length, planDate: board.planDate, planKey: board.planKey, revision: Number(data.revision), evaluatedAt, selectedOptions: board.selectedOptions };
}

export { MYFANS_PUBLIC_COPY_GENERATOR_VERSION };
