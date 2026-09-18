import { MYFANS_PUBLIC_COPY_GENERATOR_VERSION, buildMyfansExecutionBoard } from "@/lib/myfansXExecution";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bestResolverEvidence } from "@/lib/myfansProductResolver";

type MyfansExecutionBoard = ReturnType<typeof buildMyfansExecutionBoard>;
type MyfansDailyCandidate = MyfansExecutionBoard["candidates"][number];
type MyfansDailyCandidateOption = MyfansExecutionBoard["candidateOptions"][number]["candidates"][number];
type MyfansAttentionCandidate = MyfansExecutionBoard["quotePool"]["global"][number]["candidate"];
type ExistingPlanRow = { id: number; revision?: number | null; strategy_json?: Record<string, unknown> | null };

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
    is_selected: (option?.optionLabel ?? "A") === "A",
    selected_at: (option?.optionLabel ?? "A") === "A" ? new Date().toISOString() : null,
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

function dailyPlanSelectedRecords(dailyPlanId: number, board: MyfansExecutionBoard) {
  return board.candidates.map((candidate, index) => {
    const record = dailyPlanPostRecord(dailyPlanId, board, candidate, index);
    return {
      daily_plan_id: record.daily_plan_id,
      product_id: record.product_id,
      quote_candidate_id: record.quote_candidate_id,
      post_order: record.post_order,
      post_role: record.post_role,
      audience_intent: record.audience_intent,
      hook_type: record.hook_type,
      creative_strategy: record.creative_strategy,
      quality_score: record.quality_score,
      quality_verdict: record.quality_verdict,
      evidence_json: record.evidence_json,
      generator_version: record.generator_version,
      copy_input_hash: record.copy_input_hash,
      body: record.body,
      self_reply: record.self_reply,
    };
  });
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

async function insertDailyPlanPosts(dailyPlanId: number, board: MyfansExecutionBoard) {
  const optionRecords = dailyPlanOptionRecords(dailyPlanId, board);
  if (optionRecords.length) {
    const optionResult = await supabaseAdmin.from("myfans_daily_plan_posts").insert(optionRecords);
    if (!optionResult.error) return null;
    if (!/option_label|option_name|option_rank|is_selected|selected_at|novelty_json|duplicate key|myfans_daily_plan_posts_daily_plan_id_post_order_key/i.test(optionResult.error.message)) {
      return optionResult.error;
    }
  }
  const selectedResult = await supabaseAdmin.from("myfans_daily_plan_posts").insert(dailyPlanSelectedRecords(dailyPlanId, board));
  return selectedResult.error;
}

async function saveSupplyAudit(dailyPlanId: number, board: MyfansExecutionBoard) {
  const result = await supabaseAdmin.from("myfans_daily_plan_funnel_audit").insert({
    daily_plan_id: dailyPlanId,
    plan_date: board.planDate,
    revision: null,
    audit_json: board.supplyAudit,
  });
  if (result.error && !/myfans_daily_plan_funnel_audit|relation|schema cache|does not exist/i.test(result.error.message)) {
    console.error("myfans supply audit save failed", result.error.message);
  }
}

export async function ensureMyfansDailySnapshot(board: MyfansExecutionBoard): Promise<MyfansDailySnapshotResult> {
  const approvedMediaId = board.candidates[0]?.approvedMediaId ?? null;
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
    daily_option_selection: {},
  };
  const evaluatedAt = new Date().toISOString();

  const { existing, readError, supportsRevisionColumns } = await readExistingPlan(approvedMediaId, board.planDate);

  if (readError) {
    return {
      id: null,
      status: "unavailable",
      message: `Daily Snapshotを読めません: ${readError.message}`,
      postCount: 0,
      planDate: board.planDate,
      planKey: board.planKey,
      revision: null,
      evaluatedAt: null,
      selectedOptions: {},
    };
  }

  if (existing?.id) {
    const selectedOptions = (existing.strategy_json?.daily_option_selection && typeof existing.strategy_json.daily_option_selection === "object"
      ? existing.strategy_json.daily_option_selection
      : {}) as Record<string, string>;
    const nextRevision = (existing.revision ?? 0) + 1;
    const updateRecord = {
      operation_day: board.day,
      stage: board.stage,
      plan_key: board.planKey,
      strategy_json: { ...strategyJson, daily_option_selection: selectedOptions },
      updated_at: evaluatedAt,
      ...(supportsRevisionColumns ? {
        revision: nextRevision,
        evaluated_at: evaluatedAt,
        source_counts_json: board.quotePool.funnel,
      } : {}),
    };
    await supabaseAdmin
      .from("myfans_daily_plans")
      .update(updateRecord)
      .eq("id", existing.id);
    await supabaseAdmin.from("myfans_daily_plan_posts").delete().eq("daily_plan_id", existing.id);
    await supabaseAdmin
      .from("myfans_attention_candidates")
      .delete()
      .eq("approved_media_id", approvedMediaId)
      .eq("plan_date", board.planDate);
    if (board.candidates.length) {
      await insertDailyPlanPosts(existing.id, board);
    }
    await supabaseAdmin.from("myfans_daily_plan_funnel_audit").delete().eq("daily_plan_id", existing.id);
    await saveSupplyAudit(existing.id, board);
    await syncProductLinkageEvidence(board);
    await syncAttentionCandidates(approvedMediaId, board);
    return {
      id: existing.id,
      status: "existing",
      message: "同日のDaily Snapshotを同じIDのまま再評価しました",
      postCount: board.candidates.length,
      planDate: board.planDate,
      planKey: board.planKey,
      revision: supportsRevisionColumns ? nextRevision : null,
      evaluatedAt,
      selectedOptions,
    };
  }

  const insertRecord = {
    approved_media_id: approvedMediaId,
    plan_date: board.planDate,
    operation_day: board.day,
    stage: board.stage,
    plan_key: board.planKey,
    strategy_json: strategyJson,
    ...(supportsRevisionColumns ? {
      revision: 1,
      evaluated_at: evaluatedAt,
      source_counts_json: board.quotePool.funnel,
    } : {}),
  };
  const { data: plan, error: insertError } = await supabaseAdmin
    .from("myfans_daily_plans")
    .insert(insertRecord)
    .select("id")
    .single();

  if (insertError || !plan) {
    return {
      id: null,
      status: "unavailable",
      message: `Daily Snapshotを保存できません: ${insertError?.message ?? "unknown error"}`,
      postCount: 0,
      planDate: board.planDate,
      planKey: board.planKey,
      revision: null,
      evaluatedAt: null,
      selectedOptions: {},
    };
  }

  if (board.candidates.length) {
    const postsError = await insertDailyPlanPosts(plan.id, board);
    if (postsError) {
      return {
        id: plan.id,
        status: "unavailable",
        message: `Planは保存済みですが投稿snapshot保存に失敗しました: ${postsError.message}`,
        postCount: 0,
        planDate: board.planDate,
        planKey: board.planKey,
        revision: 1,
        evaluatedAt,
        selectedOptions: {},
      };
    }
  }

  await saveSupplyAudit(plan.id, board);

  await syncAttentionCandidates(approvedMediaId, board);
  await syncProductLinkageEvidence(board);

  if (board.outboundTasks.length) {
    await supabaseAdmin.from("myfans_outbound_tasks").insert(
      board.outboundTasks.map((task) => ({
        approved_media_id: approvedMediaId,
        plan_date: board.planDate,
        task_type: task.type,
        target_url: task.targetUrl,
        reason: task.reason,
        suggested_text: task.suggestedText,
      })),
    );
  }

  return {
    id: plan.id,
    status: "saved",
    message: "今日のDaily Snapshotを保存しました",
    postCount: board.candidates.length,
    planDate: board.planDate,
    planKey: board.planKey,
    revision: supportsRevisionColumns ? 1 : null,
    evaluatedAt,
    selectedOptions: {},
  };
}

export { MYFANS_PUBLIC_COPY_GENERATOR_VERSION };

async function readExistingPlan(approvedMediaId: number | null, planDate: string): Promise<{
  existing: ExistingPlanRow | null;
  readError: { message: string } | null;
  supportsRevisionColumns: boolean;
}> {
  const base = supabaseAdmin
    .from("myfans_daily_plans")
    .select("id,revision,strategy_json")
    .eq("plan_date", planDate)
    .order("id", { ascending: false })
    .limit(1);
  const withMedia = approvedMediaId === null ? base.is("approved_media_id", null) : base.eq("approved_media_id", approvedMediaId);
  const result = await withMedia.maybeSingle();
  if (!result.error) return { existing: result.data as ExistingPlanRow | null, readError: null, supportsRevisionColumns: true };
  if (!/revision/i.test(result.error.message)) return { existing: null, readError: result.error, supportsRevisionColumns: true };

  const fallbackBase = supabaseAdmin
    .from("myfans_daily_plans")
    .select("id,strategy_json")
    .eq("plan_date", planDate)
    .order("id", { ascending: false })
    .limit(1);
  const fallbackWithMedia = approvedMediaId === null ? fallbackBase.is("approved_media_id", null) : fallbackBase.eq("approved_media_id", approvedMediaId);
  const fallback = await fallbackWithMedia.maybeSingle();
  return { existing: fallback.data as ExistingPlanRow | null, readError: fallback.error, supportsRevisionColumns: false };
}

async function syncAttentionCandidates(approvedMediaId: number | null, board: MyfansExecutionBoard) {
  if (!board.quotePool.global.length) return;
  const selectedQuoteIds = new Set(
    board.candidates
      .filter((candidate) => candidate.creativeStrategy === "quote_post" && candidate.quoteXUrl)
      .map((candidate) => board.quotePool.global.find((row) => row.candidate.x_post_url === candidate.quoteXUrl || row.candidate.media_permalink === candidate.quoteXUrl)?.candidate.id)
      .filter((id): id is number => Boolean(id)),
  );
  await supabaseAdmin.from("myfans_attention_candidates").upsert(
    board.quotePool.global.slice(0, 10).map((row, index) => ({
      approved_media_id: approvedMediaId,
      quote_candidate_id: row.candidate.id,
      product_id: row.candidate.product_id,
      plan_date: board.planDate,
      attention_score: row.globalScore,
      score_json: {
        global_score: row.globalScore,
        source_score: row.candidate.score,
        rank: index + 1,
        selected_by_daily_planner: selectedQuoteIds.has(row.candidate.id),
      },
      evidence_json: {
        selected: selectedQuoteIds.has(row.candidate.id),
        selected_reason: selectedQuoteIds.has(row.candidate.id) ? "Daily Planner final quote selection" : null,
        companion_selected_for_today: row.candidate.selected_for_today ?? false,
        companion_global_rank: row.candidate.global_rank ?? null,
        visual_verified: row.candidate.quote_visual_ready,
        visual_render_status: visualRenderStatus(row.candidate),
        media_type: row.candidate.media_type,
        media_permalink: row.candidate.media_permalink,
        views: row.candidate.views,
        likes: row.candidate.likes,
        reposts: row.candidate.reposts,
        replies: row.candidate.replies,
        creator_rank: row.candidate.creator_rank,
        reason: row.candidate.score_reason,
      },
    })),
    { onConflict: "approved_media_id,quote_candidate_id,plan_date" },
  );
}

async function syncProductLinkageEvidence(board: MyfansExecutionBoard) {
  const rows = [
    ...board.candidates,
    ...(board.candidateOptions ?? []).flatMap((slot) => slot.candidates),
  ]
    .map((candidate) => candidate.resolverEvidence)
    .filter((row): row is NonNullable<typeof row> => Boolean(row?.source_status_url && row.discovered_myfans_url && row.diagnostic_mode !== true));
  if (!rows.length) return;
  const uniqueRows = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.source_status_url}\u0000${row.discovered_myfans_url}\u0000${row.evidence_source}`;
    const existing = uniqueRows.get(key);
    uniqueRows.set(key, existing ? bestResolverEvidence([existing, row]) ?? row : row);
  }
  const { error } = await supabaseAdmin
    .from("myfans_post_product_linkage_evidence")
    .upsert(
      [...uniqueRows.values()].map((row) => ({
        approved_media_id: row.approved_media_id ?? null,
        quote_candidate_id: row.quote_candidate_id ?? null,
        source_status_url: row.source_status_url,
        source_author_handle: row.source_author_handle,
        discovered_myfans_url: row.discovered_myfans_url,
        final_myfans_url: row.final_myfans_url ?? null,
        product_id: row.product_id ?? null,
        resolution_method: row.resolution_method,
        confidence: row.confidence,
        evidence_source: row.evidence_source,
        verified_at: row.verified_at,
        metadata: row.metadata ?? {},
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "source_status_url,discovered_myfans_url,evidence_source" },
    );
  if (error && !/myfans_post_product_linkage_evidence|schema cache|does not exist/i.test(error.message)) throw error;
}
