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

function snapshotEvidence(candidate: MyfansDailyCandidate | MyfansDailyCandidateOption, board: MyfansExecutionBoard) {
  return {
    public_copy: {
      body: candidate.body,
      self_reply: candidate.selfReply,
      generator_version: candidate.generatorVersion,
      copy_input_hash: candidate.copyInputHash,
      facts: candidate.publicCopyFacts,
      visual_understanding: candidate.visualUnderstanding,
      visual_analysis_status: candidate.visualUnderstanding?.visualAnalysisStatus ?? "unavailable",
      analyzer_version: candidate.visualUnderstanding?.analyzerVersion ?? null,
      visual_analysis_json: candidate.visualUnderstanding ?? null,
      extracted_visual_cue: candidate.visualUnderstanding?.concreteVisualCue ?? "",
      raw_visual_evidence: candidate.visualUnderstanding?.rawVisualEvidence ?? "",
      human_observation: candidate.visualUnderstanding?.humanObservation ?? "",
      confidence: candidate.visualUnderstanding?.cueConfidence ?? "low",
      source_evidence: candidate.visualUnderstanding?.evidenceSource || candidate.visualUnderstanding?.sourceEvidence || "",
      reaction_type: candidate.reactionType,
      reaction_review: candidate.reactionReview,
      natural_user_reaction: candidate.reactionReview?.naturalUserReaction ?? null,
      analyst_commentary_risk: candidate.reactionReview?.analystCommentaryRisk ?? null,
      source_specificity: candidate.reactionReview?.sourceSpecificity ?? candidate.sourceSpecificityScore,
      why_this_angle: candidate.whyThisAngle,
      topic_value: candidate.topicValue,
      reason_to_care: candidate.topicValue?.reasonToCare ?? null,
    },
    internal_reasoning: {
      why_selected: candidate.reason,
      quality_reason: candidate.quality.reasons,
      topic_value: candidate.topicValue,
      evidence: candidate.hookEvidence,
      validation_status: candidate.mediaPolicy,
      estimated_reward_per_1000_impressions: candidate.opportunity?.expectedRewardPer1000Impressions ?? null,
      revenue_score: candidate.opportunity?.revenueScore ?? null,
      growth_score: candidate.opportunity?.growthScore ?? null,
      creator_ltv_score: candidate.opportunity?.creatorLtvScore ?? null,
    },
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
    recovery_history: board.recovery.history.filter((row) => row.slot === candidate.plannedSlot),
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

function dailyPlanPostRecord(dailyPlanId: number, board: MyfansExecutionBoard, candidate: MyfansDailyCandidate | MyfansDailyCandidateOption, index: number, option?: MyfansDailyCandidateOption) {
  const persistedProductId = candidate.monetizableStatus === "unlinked" || candidate.sourceProductMatch?.matched === false
    ? null
    : candidate.product?.id ?? null;
  return {
    daily_plan_id: dailyPlanId,
    product_id: persistedProductId,
    quote_candidate_id: board.quotePool.global.find((row) => {
      const sourceUrl = candidate.quoteXUrl || candidate.sourceXUrl;
      return sourceUrl && (row.candidate.x_post_url === sourceUrl || row.candidate.media_permalink === sourceUrl);
    })?.candidate.id ?? null,
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
    option_label: option?.optionLabel ?? "A",
    option_name: option?.optionName ?? "おすすめ",
    option_rank: option?.optionRank ?? 1,
    is_selected: option ? Boolean(board.selectedOptions?.[String(index + 1)] === option.optionLabel) : true,
    selected_at: option && board.selectedOptions?.[String(index + 1)] === option.optionLabel ? new Date().toISOString() : null,
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

function summarizeCandidateOptions(board: MyfansExecutionBoard) {
  return (board.candidateOptions ?? []).map((slot) => ({
    slot: slot.slot,
    post_order: slot.postOrder,
    recommended_option: slot.recommendedOption,
    candidates: slot.candidates.map((candidate) => ({
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
      product_id: candidate.product?.id ?? null,
      ranking_context_product_id: candidate.rankingContextProduct?.id ?? null,
      product_title: candidate.product?.title ?? "",
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
      reason_to_care: candidate.topicValue?.reasonToCare ?? null,
      visual_status: candidate.visualUnderstanding?.visualAnalysisStatus ?? "unavailable",
      visual_evidence: candidate.visualUnderstanding?.humanObservation || candidate.visualUnderstanding?.rawVisualEvidence || "",
      quality: candidate.quality.total,
      topic_value: candidate.topicValue?.score ?? null,
      novelty: candidate.novelty,
      novelty_label: candidate.novelty?.label ?? null,
      same_source_status: candidate.novelty?.sameSourceLabel ?? null,
      last_same_source_date: candidate.novelty?.lastSameSourceDate ?? null,
      last_same_creator_date: candidate.novelty?.lastSameCreatorDate ?? null,
      past_body_similarity_label: candidate.novelty?.pastBodySimilarityLabel ?? null,
      why_selected: candidate.reason,
    })),
  }));
}

export async function ensureMyfansDailySnapshot(board: MyfansExecutionBoard, approvedMediaId: number | null = board.candidates[0]?.approvedMediaId ?? null): Promise<MyfansDailySnapshotResult> {
  const strategyJson = {
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
  const evaluatedAt = new Date().toISOString();
  const posts = dailyPlanOptionRecords(0, board).map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== "daily_plan_id")));
  const attention = board.quotePool.global.slice(0, 10).map((row, index) => ({
    quote_candidate_id: row.candidate.id,
    product_id: row.candidate.product_id,
    attention_score: row.globalScore,
    score_json: { global_score: row.globalScore, source_score: row.candidate.score, rank: index + 1 },
    evidence_json: { visual_verified: row.candidate.quote_visual_ready, visual_render_status: visualRenderStatus(row.candidate), media_type: row.candidate.media_type, media_permalink: row.candidate.media_permalink, views: row.candidate.views, likes: row.candidate.likes, reposts: row.candidate.reposts, replies: row.candidate.replies, creator_rank: row.candidate.creator_rank, reason: row.candidate.score_reason },
  }));
  const linkageRows = [...board.candidates, ...(board.candidateOptions ?? []).flatMap((slot) => slot.candidates)]
    .map((candidate) => candidate.resolverEvidence)
    .filter((row): row is NonNullable<typeof row> => Boolean(row?.source_status_url && row.discovered_myfans_url && row.diagnostic_mode !== true))
    .map((row) => ({ approved_media_id: row.approved_media_id ?? null, quote_candidate_id: row.quote_candidate_id ?? null, source_status_url: row.source_status_url, source_author_handle: row.source_author_handle, discovered_myfans_url: row.discovered_myfans_url, final_myfans_url: row.final_myfans_url ?? null, product_id: row.product_id ?? null, resolution_method: row.resolution_method, confidence: row.confidence, evidence_source: row.evidence_source, verified_at: row.verified_at, metadata: row.metadata ?? {} }));
  const linkage = [...new Map(linkageRows.map((row) => [
    `${row.source_status_url}\u0000${row.discovered_myfans_url}\u0000${row.evidence_source}`,
    row,
  ])).values()];
  const outbound = board.outboundTasks.map((task) => ({ task_type: task.type, target_url: task.targetUrl, reason: task.reason, suggested_text: task.suggestedText }));
  const plan = {
    approved_media_id: approvedMediaId,
    plan_date: board.planDate,
    operation_day: board.day,
    stage: board.stage,
    plan_key: board.planKey,
    evaluated_at: evaluatedAt,
    strategy_json: { ...strategyJson, daily_option_selection: board.selectedOptions },
    source_counts_json: board.quotePool.funnel,
  };
  const { data, error } = await supabaseAdmin.rpc("save_myfans_daily_snapshot", {
    p_plan: plan,
    p_posts: posts,
    p_attention: attention,
    p_linkage: linkage,
    p_outbound: outbound,
    p_audit: board.supplyAudit,
  });
  if (error || !data?.plan_id) {
    const errorCode = typeof error?.code === "string" ? error.code : "RPC_EMPTY_RESULT";
    console.error("myfans daily snapshot RPC failed", {
      code: errorCode,
      message: typeof error?.message === "string" ? error.message : "invalid response",
      details: typeof error?.details === "string" ? error.details : undefined,
      hint: typeof error?.hint === "string" ? error.hint : undefined,
    });
    return { id: null, status: "unavailable", message: "Daily Planの保存に失敗しました。保存状態は変更されていません。時間をおいて再試行してください。", errorCode, postCount: 0, planDate: board.planDate, planKey: board.planKey, revision: null, evaluatedAt: null, selectedOptions: board.selectedOptions };
  }
  const replaced = data.replaced === true;
  return { id: Number(data.plan_id), status: replaced ? "existing" : "saved", message: replaced ? "同日のDaily Planをatomicに再評価しました" : "今日のDaily Planを保存しました", postCount: board.candidates.length, planDate: board.planDate, planKey: board.planKey, revision: Number(data.revision), evaluatedAt, selectedOptions: board.selectedOptions };
}

export { MYFANS_PUBLIC_COPY_GENERATOR_VERSION };
