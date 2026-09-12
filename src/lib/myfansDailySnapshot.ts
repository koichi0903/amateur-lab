import { MYFANS_PUBLIC_COPY_GENERATOR_VERSION, buildMyfansExecutionBoard } from "@/lib/myfansXExecution";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type MyfansExecutionBoard = ReturnType<typeof buildMyfansExecutionBoard>;
type MyfansDailyCandidate = MyfansExecutionBoard["candidates"][number];
type MyfansAttentionCandidate = MyfansExecutionBoard["quotePool"]["global"][number]["candidate"];
type ExistingPlanRow = { id: number; revision?: number | null };

export type MyfansDailySnapshotResult = {
  id: number | null;
  status: "saved" | "existing" | "unavailable";
  message: string;
  postCount: number;
  planDate: string;
  planKey: string;
  revision: number | null;
  evaluatedAt: string | null;
};

function snapshotEvidence(candidate: MyfansDailyCandidate, board: MyfansExecutionBoard) {
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
    quote_x_url: candidate.quoteXUrl,
    affiliate_url: candidate.affiliateUrl,
    source_x_url: candidate.sourceXUrl,
    planned_slot: candidate.plannedSlot,
    objective: candidate.objective,
    link_strategy: candidate.linkStrategy,
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
    topic_value_funnel: board.topicValue.funnel,
    topic_value_top10: board.topicValue.top10,
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
    };
  }

  if (existing?.id) {
    const nextRevision = (existing.revision ?? 0) + 1;
    const updateRecord = {
      operation_day: board.day,
      stage: board.stage,
      plan_key: board.planKey,
      strategy_json: strategyJson,
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
      await supabaseAdmin.from("myfans_daily_plan_posts").insert(
        board.candidates.map((candidate, index) => ({
          daily_plan_id: existing.id,
          product_id: candidate.product?.id ?? null,
          quote_candidate_id: board.quotePool.global.find((row) => candidate.quoteXUrl && (row.candidate.x_post_url === candidate.quoteXUrl || row.candidate.media_permalink === candidate.quoteXUrl))?.candidate.id ?? null,
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
        })),
      );
    }
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
    };
  }

  if (board.candidates.length) {
    const { error: postsError } = await supabaseAdmin.from("myfans_daily_plan_posts").insert(
      board.candidates.map((candidate, index) => ({
        daily_plan_id: plan.id,
        product_id: candidate.product?.id ?? null,
        quote_candidate_id: board.quotePool.global.find((row) => candidate.quoteXUrl && (row.candidate.x_post_url === candidate.quoteXUrl || row.candidate.media_permalink === candidate.quoteXUrl))?.candidate.id ?? null,
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
      })),
    );
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
      };
    }
  }

  await syncAttentionCandidates(approvedMediaId, board);

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
    .select("id,revision")
    .eq("plan_date", planDate);
  const withMedia = approvedMediaId === null ? base.is("approved_media_id", null) : base.eq("approved_media_id", approvedMediaId);
  const result = await withMedia.maybeSingle();
  if (!result.error) return { existing: result.data as ExistingPlanRow | null, readError: null, supportsRevisionColumns: true };
  if (!/revision/i.test(result.error.message)) return { existing: null, readError: result.error, supportsRevisionColumns: true };

  const fallbackBase = supabaseAdmin
    .from("myfans_daily_plans")
    .select("id")
    .eq("plan_date", planDate);
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
