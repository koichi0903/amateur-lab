import type { buildStrategicMission } from "@/lib/x-growth/xGrowthPlanning";
import { getXApiCapabilityStatus } from "@/lib/xApi";
import type { XMediaAsset } from "@/lib/xMediaAssets";
import type { XCreativeLearningRow } from "@/lib/xPostLogs";
import type { XGrowthOpportunity } from "@/lib/xGrowthOS";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ACCOUNT, todayTokyo, withXPostTrackingText, scoreBreakdown, isMissingRelation } from "./x-growth/xGrowthOperationUtils";
import type { XDailyPlanStatus, XOpportunityStatus } from "./x-growth/xGrowthDailyOperations";
import { buildRankingSnapshotHistories, type RankingSnapshotRow } from "./x-growth/xGrowthRankingSnapshotHistory";

export * from "./x-growth/xGrowthDailyOperations";
export { buildSeriesIdeas, buildStrategicMission } from "@/lib/x-growth/xGrowthPlanning";
export { auditXGrowth, fetchMediaAssets, analyzeUncachedVideoFacts, applyMediaEligibility, checkMediaAssetUrlsForWorkIds, syncSampleMovieAssetsForWorkIds, syncSampleMovieAssets, reviewMediaAsset, updateMediaAssetTrim } from "./x-growth/xGrowthMediaOperations";

export type PersistedOpportunity = {
  id: number;
  status: XOpportunityStatus;
  opportunity_key: string;
  recommended_media_asset_id: number | null;
};

export type XGrowthSystemStatus = {
  migrationApplied: boolean;
  migrationError: string | null;
  rankingSnapshotsReady: boolean;
  rankingSnapshotsError: string | null;
  accountSubscription: "free";
  xBearerConfigured: boolean;
  xUserAccessTokenConfigured: boolean;
  xPostingConfigured: boolean;
  xMediaUploadConfigured: boolean;
  requiredForPosting: string[];
  notes: string[];
};

export function getXGrowthSystemStatus(error: string | null, rankingSnapshotsError: string | null = null): XGrowthSystemStatus {
  const capability = getXApiCapabilityStatus();
  return {
    migrationApplied: !error && !rankingSnapshotsError,
    migrationError: error ?? rankingSnapshotsError,
    rankingSnapshotsReady: !rankingSnapshotsError,
    rankingSnapshotsError,
    accountSubscription: capability.accountPlan,
    xBearerConfigured: capability.hasBearerToken,
    xUserAccessTokenConfigured: capability.hasUserAccessToken,
    xPostingConfigured: capability.postingConfigured,
    xMediaUploadConfigured: capability.mediaUploadConfigured,
    requiredForPosting: capability.requiredForPosting,
    notes: capability.notes,
  };
}

export async function persistOpportunities(items: XGrowthOpportunity[]) {
  if (!items.length) return { rows: [] as PersistedOpportunity[], error: null as string | null };
  const rows = items.map((item) => {
    const postText = withXPostTrackingText(item.postText, item.key);
    const replyText = withXPostTrackingText(item.replyText, item.key);
    return ({
    account_handle: ACCOUNT,
    opportunity_key: item.key,
    work_id: item.workId,
    product_id: item.productId,
    opportunity_date: todayTokyo(),
    event_type: item.eventType,
    topic: item.topic,
    intent: item.intent,
    reach_score: item.reachScore,
    follow_score: item.followScore,
    authority_score: item.authorityScore,
    revenue_score: item.revenueScore,
    evidence: item.evidence,
    post_text: postText,
    reply_text: replyText,
    post_intent: item.postIntent,
    media_type: item.mediaType,
    recommended_media_asset_id: "mediaAsset" in item ? (item.mediaAsset as XMediaAsset | null)?.id ?? null : null,
    score_breakdown: scoreBreakdown(item),
    creative_genome: {
      ...item.creativeGenome,
      source_type: item.sourceType,
      decision_facts: item.decisionFacts,
      recommended_variant_id: item.creativeVariantId,
      variants: item.creativeVariants?.map((variant) => ({
        id: variant.id,
        intent: variant.intent,
        hook: variant.hookType,
        proof: variant.creativeGenome.proof,
        structure: variant.structure,
        media: variant.mediaType,
        cta: variant.ctaStrategy,
        link_strategy: variant.linkPlan,
        quality_total: variant.quality.total,
        gate_passed: variant.quality.passed,
      })) ?? [],
    },
    adoption_reason: item.selectionReason,
    });
  });
  const { data, error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .upsert(rows, { onConflict: "account_handle,opportunity_key,opportunity_date" })
    .select("id,status,opportunity_key,recommended_media_asset_id");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as PersistedOpportunity[], error: null };
}

export async function upsertDailyPlan(mission: ReturnType<typeof buildStrategicMission>, status: XDailyPlanStatus = "draft") {
  const { data, error } = await supabaseAdmin
    .from("x_growth_daily_plans")
    .upsert({
      account_handle: ACCOUNT,
      plan_date: todayTokyo(),
      primary_bottleneck: mission.bottleneck,
      mission_title: mission.title,
      mission_reason: mission.reason,
      target_mix: mission.mix,
      recommended_actions: mission.actions,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_handle,plan_date" })
    .select("*")
    .single();
  return { plan: data, error: error?.message ?? null };
}

export async function persistCreativeLearning(rows: XCreativeLearningRow[]) {
  const inserts = rows.map((row) => ({
    account_handle: ACCOUNT,
    topic: row.label,
    intent: "MONEY",
    hook: row.dimension === "hook_type" ? row.value : "mixed",
    proof: "actual_result",
    structure: row.dimension,
    emotion: row.confidence,
    length_bucket: "mixed",
    media: row.dimension === "image_strategy" ? row.value : "mixed",
    cta: row.dimension === "cta_strategy" ? row.value : "mixed",
    link_strategy: row.dimension === "link_strategy" ? row.value : "mixed",
    posting_slot: "mixed",
    outcome_summary: row,
    learning_note: row.recommendation,
  }));
  if (!inserts.length) return { error: null };
  const { error } = await supabaseAdmin.from("x_creative_learning").insert(inserts);
  return { error: error?.message ?? null };
}

export async function buildConversationRadarFromData(items: XGrowthOpportunity[]) {
  const candidates = items.slice(0, 12).flatMap((item) => {
    const candidates = [
      item.title ? { target_type: "work", target_name: item.title, topic: item.topic } : null,
      item.seriesName ? { target_type: "series", target_name: item.seriesName, topic: `続報候補: ${item.seriesName}` } : null,
    ].filter((row): row is { target_type: string; target_name: string; topic: string } => Boolean(row));
    return candidates.map((row) => ({
      account_handle: ACCOUNT,
      ...row,
      suggested_reply: "人間確認後、価格・ランキング・レビューの独自データを添えて引用候補にする",
      status: "candidate",
      external_status: "unavailable",
    }));
  });
  const rows = Array.from(
    new Map(candidates.map((row) => [`${row.account_handle}:${row.target_type}:${row.target_name}:${row.topic}`, row])).values(),
  );
  if (!rows.length) return { rows: [], error: null as string | null };
  const { data, error } = await supabaseAdmin.from("x_conversation_radar").upsert(rows, { onConflict: "account_handle,target_type,target_name,topic" }).select("*").limit(30);
  return { rows: data ?? [], error: error?.message ?? null };
}

export async function getPersistedGrowthTables() {
  const [plans, opportunities, radar, snapshots] = await Promise.all([
    supabaseAdmin.from("x_growth_daily_plans").select("*").eq("account_handle", ACCOUNT).order("plan_date", { ascending: false }).limit(7),
    supabaseAdmin.from("x_growth_opportunities").select("*").eq("account_handle", ACCOUNT).order("created_at", { ascending: false }).limit(30),
    supabaseAdmin.from("x_conversation_radar").select("*").eq("account_handle", ACCOUNT).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("x_metric_snapshots").select("*").eq("account_handle", ACCOUNT).order("captured_at", { ascending: false }).limit(50),
  ]);
  const error = [plans.error, opportunities.error, radar.error, snapshots.error].find(isMissingRelation);
  return {
    plans: plans.data ?? [],
    opportunities: opportunities.data ?? [],
    radar: radar.data ?? [],
    snapshots: snapshots.data ?? [],
    migrationError: error?.message ?? null,
  };
}

export async function persistRankingSnapshots(items: XGrowthOpportunity[]) {
  const rows = items
    .filter((item) => item.workId && item.ranking)
    .map((item) => ({
      account_handle: ACCOUNT,
      work_id: item.workId,
      product_id: item.productId,
      ranking: item.ranking,
      source: "growth_os",
    }));
  if (!rows.length) return { saved: 0, error: null as string | null };
  const { error } = await supabaseAdmin
    .from("x_ranking_snapshots")
    .upsert(rows, { onConflict: "account_handle,work_id,captured_date" });
  return { saved: error ? 0 : rows.length, error: error?.message ?? null };
}

export async function fetchRankingSnapshotHistory(workIds: number[]) {
  const ids = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  const histories = new Map<number, { observations: number; previousRanking: number | null }>();
  if (!ids.length) return { histories, error: null as string | null };
  const { data, error } = await supabaseAdmin
    .from("x_ranking_snapshots")
    .select("work_id,ranking,captured_date,captured_at")
    .eq("account_handle", ACCOUNT)
    .in("work_id", ids)
    .order("captured_date", { ascending: false })
    .order("captured_at", { ascending: false })
    .limit(ids.length * 8);
  if (error) return { histories, error: error.message };
  const snapshotRows = (data ?? []) as RankingSnapshotRow[];
  return { histories: buildRankingSnapshotHistories(snapshotRows), error: null };
}
