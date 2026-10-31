import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanupTempVideo, createXPost, downloadTempVideo } from "@/lib/xApi";
import { canTrimFanzaXGrowthSampleMovie, isFanzaXGrowthTechnicalSampleMovie, type XMediaAsset } from "@/lib/xMediaAssets";
import type { XPostLogInput } from "@/lib/xPostLogs";
import { saveXPostLog } from "@/lib/xPostLogs";
import { xPostKeyFromText } from "@/lib/xPostTracking";
import { buildXGrowthPostLogInput } from "./xGrowthPostExecutionData";
import { normalizeTopPickCandidates } from "@/lib/xGrowthTopPicks";
import type { XDailyMission, XDailyTopPick } from "@/lib/xGrowthOS";
import { mergePersistedTopPickMediaAsset, serializeTopPick } from "./xGrowthDailyPlanSerialization";
import { buildPersistedTopPickFallback } from "./xGrowthDailyPlanFallback";
import type { PersistedTopPickMediaAsset, PersistedXDailyPlan, SerializedTopPick, XDailyPlanStatus } from "./xGrowthDailyPlanSerialization";
import { buildCandidateSelectionAuditIdentity } from "./xGrowthSelectionAudit";
export { mergePersistedTopPickMediaAsset };
export type { PersistedXDailyPlan, SerializedTopPick, XDailyPlanStatus };
import { auditXGrowth } from "@/lib/xGrowthMediaOperations";
import { ACCOUNT, todayTokyo, withXPostTrackingText, scoreBreakdown, isMissingRelation } from "./xGrowthOperationUtils";

export type XOpportunityStatus = "candidate" | "adopted" | "rejected" | "posted" | "expired";

async function hydratePersistedTopPickMediaAssets(plan: PersistedXDailyPlan | null) {
  if (!plan?.top_picks?.length) return plan;
  const workIds = [...new Set(plan.top_picks.map((pick) => pick.workId).filter((id): id is number => Number.isSafeInteger(id)))];
  if (!workIds.length) return plan;
  const { data, error } = await supabaseAdmin
    .from("x_media_assets")
    .select("id,work_id,media_type,source_url,media_quality,manual_tags,review_source,x_usage_allowed,rights_status,can_modify,trim_start_seconds,trim_reviewed_at,trim_modify_confirmed,trim_note")
    .eq("account_handle", ACCOUNT)
    .in("work_id", workIds);
  if (error) return plan;
  const assets = new Map((data ?? []).map((asset) => [Number(asset.id), asset as PersistedTopPickMediaAsset]));
  const assetsByWorkId = new Map<number, PersistedTopPickMediaAsset[]>();
  for (const asset of assets.values()) {
    if (!Number.isSafeInteger(asset.work_id)) continue;
    const current = assetsByWorkId.get(asset.work_id as number) ?? [];
    current.push(asset);
    assetsByWorkId.set(asset.work_id as number, current);
  }
  return {
    ...plan,
    top_picks: plan.top_picks.map((pick) => mergePersistedTopPickMediaAsset(pick, assets, assetsByWorkId)),
  };
}

export async function getPostedWorkIds(workIds?: readonly number[]) {
  const scopedWorkIds = workIds === undefined
    ? undefined
    : [...new Set(workIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (scopedWorkIds && !scopedWorkIds.length) return { workIds: new Set<number>(), error: null as string | null };

  const baseQuery = supabaseAdmin
    .from("x_post_logs")
    .select("work_id")
    .eq("account_handle", ACCOUNT)
    .not("work_id", "is", null);
  const query = scopedWorkIds ? baseQuery.in("work_id", scopedWorkIds) : baseQuery;
  const { data, error } = await query.limit(10_000);
  if (error) return { workIds: new Set<number>(), error: error.message };
  return {
    workIds: new Set((data ?? []).map((row) => Number((row as { work_id?: unknown }).work_id)).filter((id) => Number.isSafeInteger(id) && id > 0)),
    error: null as string | null,
  };
}

async function normalizePersistedPlan(plan: PersistedXDailyPlan | null) {
  if (!plan) return plan;
  const workIds = plan.top_picks.map((pick) => pick.workId).filter((id): id is number => Number.isSafeInteger(id) && id > 0);
  const posted = await getPostedWorkIds(workIds);
  const topPicks = normalizeTopPickCandidates(plan.top_picks, posted.workIds) as SerializedTopPick[];
  return { ...plan, top_picks: topPicks, stale_reason: posted.error ? posted.error : plan.stale_reason };
}

async function invalidateTodayPlanWork(workId: number) {
  const { data } = await supabaseAdmin.from("x_growth_daily_plans").select("id,top_picks").eq("account_handle", ACCOUNT).eq("plan_date", todayTokyo()).maybeSingle();
  if (!data) return;
  const plan = data as { id: number; top_picks: unknown };
  const topPicks = normalizeTopPickCandidates(plan.top_picks, new Set([workId]));
  if (Array.isArray(plan.top_picks) && topPicks.length === plan.top_picks.length) return;
  await supabaseAdmin.from("x_growth_daily_plans").update({ top_picks: topPicks, updated_at: new Date().toISOString() }).eq("account_handle", ACCOUNT).eq("id", plan.id);
}

function normalizeManualLinkStrategy(value?: string | null): "reply_link" | "body_link" | null {
  if (value === "reply_link" || value === "self_reply") return "reply_link";
  if (value === "body_link" || value === "body") return "body_link";
  return null;
}

type CandidateSelectionAuditSource = SerializedTopPick | {
  pick: Partial<SerializedTopPick>;
  row: { work_id: number | null; intent: string | null; media_type: string | null };
} | undefined;

function resolveCandidateSelectionAuditSource(source: CandidateSelectionAuditSource) {
  if (source && "pick" in source) return { pick: source.pick, row: source.row, isFallback: true };
  return { pick: source as SerializedTopPick | undefined, row: null, isFallback: false };
}

function candidateSelectionAuditCreative(pick: Partial<SerializedTopPick> | undefined, row: { media_type: string | null } | null) {
  return {
    creativeAngle: pick?.creativeAngle ?? null,
    media_strategy: pick?.mediaType ?? row?.media_type ?? null,
    link_strategy: pick?.setDiversity?.signature?.linkStrategy ?? null,
  };
}

async function auditDailyPlanCandidateSelection(
  input: { slotId: string; candidateId: string },
  source: CandidateSelectionAuditSource,
) {
  const resolved = resolveCandidateSelectionAuditSource(source);
  await auditXGrowth("daily_plan_candidate_selected", {
    ...buildCandidateSelectionAuditIdentity({ ...input, date: todayTokyo() }, resolved.pick, resolved.row),
    ...candidateSelectionAuditCreative(resolved.pick, resolved.row),
    selected_at: new Date().toISOString(),
    ...(resolved.isFallback ? { storage: "x_growth_opportunities_fallback" } : {}),
  });
}

export async function recordManualXPost(input: {
  workId: number;
  candidateId?: string | null;
  slotId?: string | null;
  candidateRank?: string | null;
  slotRole?: string | null;
  title: string;
  postText: string;
  xPostId: string;
  trackingUrl?: string | null;
  intent?: string | null;
  mediaAssetId?: number | null;
  linkStrategy?: string | null;
}) {
  if (!Number.isSafeInteger(input.workId) || input.workId <= 0) return { error: "作品IDが不正です。" };
  if (!/^\d{8,25}$/.test(input.xPostId)) return { error: "X投稿URLから投稿IDを確認できませんでした。" };
  const candidateId = input.candidateId?.trim() || `manual-${input.workId}`;
  const trackedPostKey = xPostKeyFromText(input.postText) ?? xPostKeyFromText(input.trackingUrl);
  const linkStrategy = normalizeManualLinkStrategy(input.linkStrategy);
  const result = await saveXPostLog({
    postKey: trackedPostKey ?? `manual-${todayTokyo()}-${candidateId}`.slice(0, 120), workId: input.workId, category: "score",
    title: input.title.slice(0, 300), postText: input.postText, postDate: todayTokyo(), accountHandle: ACCOUNT,
    xPostId: input.xPostId,
    postIntent: "work_link", scheduledSlot: input.slotId ?? null, creativeVariantId: candidateId,
    mediaAssetId: input.mediaAssetId ?? null, linkStrategy,
    creativeGenome: { candidate_id: candidateId, slot_id: input.slotId ?? null, slot_role: input.slotRole ?? null, candidate_rank: input.candidateRank ?? null, intent: input.intent ?? null, completion_source: "admin_manual_posted_button" },
  });
  if (result.error) return { error: result.error.message };
  await invalidateTodayPlanWork(input.workId);
  await auditXGrowth("manual_x_post_recorded", { workId: input.workId, candidateId, slotId: input.slotId ?? null, candidateRank: input.candidateRank ?? null });
  return { error: null };
}

export async function getPersistedTodayTopPicks() {
  const { data, error } = await supabaseAdmin
    .from("x_growth_daily_plans")
    .select("id,account_handle,plan_date,primary_bottleneck,mission_title,mission_reason,target_mix,recommended_actions,status,top_picks,supply_diagnostics,native_x_learning,performance_timings,generated_at,stale_reason")
    .eq("account_handle", ACCOUNT)
    .eq("plan_date", todayTokyo())
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return getPersistedTodayTopPicksFallback(error.message);
    return { plan: null as PersistedXDailyPlan | null, error: error.message };
  }
  const normalized = await normalizePersistedPlan(data as PersistedXDailyPlan | null);
  return { plan: await hydratePersistedTopPickMediaAssets(normalized), error: null as string | null };
}

export async function selectDailyPlanCandidate(input: {
  slotId: string;
  candidateId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("x_growth_daily_plans")
    .select("id,top_picks")
    .eq("account_handle", ACCOUNT)
    .eq("plan_date", todayTokyo())
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return selectDailyPlanCandidateFallback(input);
    return { error: error.message };
  }
  const plan = data as { id: number; top_picks: SerializedTopPick[] | null } | null;
  if (!plan?.top_picks?.length) return { error: "今日の候補プランがありません。" };
  const exists = plan.top_picks.some((pick) => pick.slotId === input.slotId && pick.candidateId === input.candidateId);
  if (!exists) return { error: "候補が見つかりません。" };
  const topPicks = plan.top_picks.map((pick) => pick.slotId === input.slotId ? { ...pick, isSelected: pick.candidateId === input.candidateId } : pick);
  const selected = topPicks.find((pick) => pick.candidateId === input.candidateId);
  const update = await supabaseAdmin
    .from("x_growth_daily_plans")
    .update({ top_picks: topPicks, updated_at: new Date().toISOString() })
    .eq("account_handle", ACCOUNT)
    .eq("id", plan.id);
  if (update.error) return { error: update.error.message };
  await auditDailyPlanCandidateSelection(input, selected);
  return { error: null };
}

async function selectDailyPlanCandidateFallback(input: {
  slotId: string;
  candidateId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .select("id,work_id,intent,media_type,creative_genome")
    .eq("account_handle", ACCOUNT)
    .eq("opportunity_date", todayTokyo())
    .like("opportunity_key", "daily-pick-%")
    .order("opportunity_key", { ascending: true });
  if (error) return { error: error.message };
  const rows = (data ?? []) as Array<{ id: number; work_id: number | null; intent: string | null; media_type: string | null; creative_genome: Record<string, unknown> | null }>;
  const withPick = rows.map((row) => {
    const genome = row.creative_genome ?? {};
    const pick = (genome.persisted_top_pick ?? {}) as Partial<SerializedTopPick>;
    return { row, genome, pick };
  });
  const exists = withPick.some(({ pick }) => pick.slotId === input.slotId && pick.candidateId === input.candidateId);
  if (!exists) return { error: "候補が見つかりません。" };
  await Promise.all(withPick.map(({ row, genome, pick }) => supabaseAdmin
    .from("x_growth_opportunities")
    .update({
      creative_genome: {
        ...genome,
        persisted_top_pick: {
          ...pick,
          isSelected: pick.slotId === input.slotId ? pick.candidateId === input.candidateId : pick.isSelected,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("account_handle", ACCOUNT)
    .eq("id", row.id)));
  const selected = withPick.find(({ pick }) => pick.candidateId === input.candidateId);
  await auditDailyPlanCandidateSelection(input, selected);
  return { error: null };
}

function fallbackPlanMetadata(planRow: Record<string, unknown> | null) {
  return {
    id: Number(planRow?.id ?? 0),
    primary_bottleneck: String(planRow?.primary_bottleneck ?? ""),
    mission_title: String(planRow?.mission_title ?? "今日のTop Picks"),
    mission_reason: String(planRow?.mission_reason ?? "保存済みTop Picksを表示しています。"),
  };
}

function fallbackPlanDiagnostics(rows: Array<Record<string, unknown>>) {
  const firstGenome = rows[0]?.creative_genome as Record<string, unknown> | undefined;
  return {
    supply_diagnostics: (firstGenome?.supply_diagnostics ?? {}) as Record<string, unknown>,
    native_x_learning: (firstGenome?.native_x_learning ?? {}) as Record<string, unknown>,
    performance_timings: (firstGenome?.performance_timings ?? {}) as Record<string, number>,
    generated_at: rows[0]?.updated_at ? String(rows[0].updated_at) : null,
  };
}

function buildFallbackDailyPlan(
  plan: unknown,
  rows: Array<Record<string, unknown>>,
  topPicks: SerializedTopPick[],
  staleReason: string,
): PersistedXDailyPlan {
  const planRow = (plan ?? null) as Record<string, unknown> | null;
  return {
    ...fallbackPlanMetadata(planRow),
    account_handle: ACCOUNT,
    plan_date: todayTokyo(),
    target_mix: (planRow?.target_mix ?? {}) as Record<string, number>,
    recommended_actions: (planRow?.recommended_actions ?? []) as PersistedXDailyPlan["recommended_actions"],
    status: (planRow?.status ?? "draft") as XDailyPlanStatus,
    top_picks: topPicks,
    ...fallbackPlanDiagnostics(rows),
    stale_reason: staleReason,
  };
}

async function getPersistedTodayTopPicksFallback(staleReason: string) {
  const { data: plan } = await supabaseAdmin
    .from("x_growth_daily_plans")
    .select("id,account_handle,plan_date,primary_bottleneck,mission_title,mission_reason,target_mix,recommended_actions,status,updated_at")
    .eq("account_handle", ACCOUNT)
    .eq("plan_date", todayTokyo())
    .maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .select("id,opportunity_key,work_id,product_id,topic,intent,evidence,post_text,reply_text,media_type,recommended_media_asset_id,score_breakdown,creative_genome,adoption_reason,updated_at")
    .eq("account_handle", ACCOUNT)
    .eq("opportunity_date", todayTokyo())
    .like("opportunity_key", "daily-pick-%")
    .order("opportunity_key", { ascending: true });
  if (error) return { plan: null as PersistedXDailyPlan | null, error: error.message };
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const topPicks = rows.map(buildPersistedTopPickFallback);
  const fallbackPlan = buildFallbackDailyPlan(plan, rows, topPicks, staleReason);
  const normalized = await normalizePersistedPlan(fallbackPlan);
  return {
    plan: await hydratePersistedTopPickMediaAssets(normalized),
    error: null as string | null,
  };
}

export async function persistDailyTopPicks(input: {
  mission: XDailyMission;
  topPicks: XDailyTopPick[];
  supplyDiagnostics: Record<string, unknown>;
  nativeXLearning: Record<string, unknown>;
  performanceTimings: Record<string, number>;
  status?: XDailyPlanStatus;
  staleReason?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("x_growth_daily_plans")
    .upsert({
      account_handle: ACCOUNT,
      plan_date: todayTokyo(),
      primary_bottleneck: input.mission.bottleneck,
      mission_title: input.mission.title,
      mission_reason: input.mission.reason,
      target_mix: input.mission.mix,
      recommended_actions: input.mission.actions,
      status: input.status ?? "draft",
      top_picks: input.topPicks.map(serializeTopPick),
      supply_diagnostics: input.supplyDiagnostics,
      native_x_learning: input.nativeXLearning,
      performance_timings: input.performanceTimings,
      generated_at: new Date().toISOString(),
      stale_reason: input.staleReason ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_handle,plan_date" })
    .select("*")
    .single();
  if (!error) await auditXGrowth("daily_top_picks_persisted", { count: input.topPicks.length, generatedAt: data?.generated_at ?? null });
  if (!error) return { plan: data as PersistedXDailyPlan | null, error: null };
  if (!isMissingRelation(error)) return { plan: null, error: error.message };
  const fallbackRows = input.topPicks.map((item) => {
    const serialized = serializeTopPick(item);
    return {
      account_handle: ACCOUNT,
      opportunity_key: `daily-pick-${String(item.pickOrder).padStart(2, "0")}-${item.key}`.slice(0, 180),
      work_id: item.workId,
      product_id: item.productId,
      opportunity_date: todayTokyo(),
      event_type: item.eventType,
      topic: item.title,
      intent: item.role,
      reach_score: item.reachScore,
      follow_score: item.followScore,
      authority_score: item.authorityScore,
      revenue_score: item.revenueScore,
      evidence: item.whyToday,
      post_text: withXPostTrackingText(item.postText, `daily-pick-${String(item.pickOrder).padStart(2, "0")}-${item.key}`),
      reply_text: withXPostTrackingText(item.replyText, `daily-pick-${String(item.pickOrder).padStart(2, "0")}-${item.key}`),
      post_intent: item.postIntent,
      media_type: item.mediaType,
      recommended_media_asset_id: item.mediaAsset?.id ?? null,
      score_breakdown: scoreBreakdown(item),
      creative_genome: {
        ...item.creativeGenome,
        persisted_top_pick: serialized,
        supply_diagnostics: input.supplyDiagnostics,
        native_x_learning: input.nativeXLearning,
        performance_timings: input.performanceTimings,
      },
      adoption_reason: item.alternativeReason ?? item.whyBuzz,
      status: "adopted",
      updated_at: new Date().toISOString(),
    };
  });
  await supabaseAdmin
    .from("x_growth_opportunities")
    .delete()
    .eq("account_handle", ACCOUNT)
    .eq("opportunity_date", todayTokyo())
    .like("opportunity_key", "daily-pick-%");
  const fallback = await supabaseAdmin
    .from("x_growth_opportunities")
    .upsert(fallbackRows, { onConflict: "account_handle,opportunity_key,opportunity_date" });
  if (!fallback.error) await auditXGrowth("daily_top_picks_persisted_fallback", { count: input.topPicks.length });
  return { plan: null, error: fallback.error?.message ?? null };
}

function adoptedLearningGenomeFields(genome: Record<string, unknown>) {
  return {
    hook: String(genome.hook ?? "unknown"),
    proof: String(genome.proof ?? "unknown"),
    structure: String(genome.structure ?? "unknown"),
    emotion: String(genome.emotion ?? "unknown"),
    length_bucket: String(genome.length ?? "unknown"),
    media: String(genome.media ?? "unknown"),
    cta: String(genome.cta ?? "unknown"),
    link_strategy: String(genome.linkStrategy ?? genome.link_strategy ?? "unknown"),
    posting_slot: String(genome.postingSlot ?? genome.posting_slot ?? "unknown"),
  };
}

function buildAdoptedOpportunityLearningRecord(id: number, row: Record<string, unknown> | null) {
  const genome = (row?.creative_genome ?? {}) as Record<string, unknown>;
  return {
    account_handle: ACCOUNT,
    post_key: row?.opportunity_key ?? null,
    work_id: row?.work_id ?? null,
    topic: String(row?.topic ?? "adopted creative"),
    intent: String(row?.intent ?? "FOLLOW"),
    ...adoptedLearningGenomeFields(genome),
    outcome_summary: { source: "admin_adoption", opportunity_id: id },
    learning_note: "採用時点のCreative Genome。実績取得後に結果で上書き評価する。",
  };
}

async function recordAdoptedOpportunityLearning(id: number) {
  const { data } = await supabaseAdmin
    .from("x_growth_opportunities")
    .select("opportunity_key,work_id,topic,intent,creative_genome")
    .eq("account_handle", ACCOUNT)
    .eq("id", id)
    .single();
  const row = data as Record<string, unknown> | null;
  await supabaseAdmin.from("x_creative_learning").insert(buildAdoptedOpportunityLearningRecord(id, row));
}

export async function updateOpportunityStatus(id: number, status: XOpportunityStatus, reason?: string) {
  const { error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .update({ status, adoption_reason: reason ?? null, updated_at: new Date().toISOString() })
    .eq("account_handle", ACCOUNT)
    .eq("id", id);
  if (error) return { error: error.message };
  if (status === "adopted") await recordAdoptedOpportunityLearning(id);
  await auditXGrowth("opportunity_status", { id, status, reason: reason ?? null });
  return { error: null };
}

async function loadOpportunityMediaAsset(
  opportunity: Record<string, unknown>,
  persistedPick: SerializedTopPick | null,
) {
  const assetId = Number(opportunity.recommended_media_asset_id);
  const virtualAsset = persistedPick?.mediaAsset?.source_url ? persistedPick.mediaAsset : null;
  let asset: Partial<XMediaAsset> | null = virtualAsset as Partial<XMediaAsset> | null;
  if (Number.isSafeInteger(assetId)) {
    const assetResult = await supabaseAdmin.from("x_media_assets").select("*").eq("account_handle", ACCOUNT).eq("id", assetId).single();
    asset = assetResult.data as XMediaAsset | null;
    if (assetResult.error || !asset) throw new Error(assetResult.error?.message ?? "Media asset not found.");
  }
  return { assetId, asset };
}

async function assertOpportunitySampleMovieTechnical(
  id: number,
  assetId: number,
  asset: Partial<XMediaAsset> | null,
  sampleMovieUrl: string | undefined,
) {
  const verdict = isFanzaXGrowthTechnicalSampleMovie(asset, sampleMovieUrl);
  if (!verdict.usable) {
    await auditXGrowth("media_technical_blocked", { opportunityId: id, mediaAssetId: assetId, reasons: verdict.reasons });
    throw new Error("公式FANZA/DMM動画のtechnical条件を満たしていません。");
  }
}

function requireOpportunitySampleMovieSource(
  asset: Partial<XMediaAsset> | null,
): asserts asset is Partial<XMediaAsset> & { source_url: string } {
  if (!asset?.source_url) throw new Error("sample_movie_urlが見つかりません。");
}

async function assertOpportunitySampleMovieTrimAllowed(
  id: number,
  assetId: number,
  asset: Partial<XMediaAsset>,
  sampleMovieUrl: string | undefined,
) {
  if (Number(asset.trim_start_seconds ?? 0) > 0) {
    const trimVerdict = canTrimFanzaXGrowthSampleMovie(asset, sampleMovieUrl);
    if (!trimVerdict.usable) {
      await auditXGrowth("media_trim_blocked", { opportunityId: id, mediaAssetId: assetId, reasons: trimVerdict.reasons });
      throw new Error(`トリム動画は使えません: ${trimVerdict.reasons.join(" / ")}`);
    }
  }
}

async function downloadOpportunitySampleMovie(
  id: number,
  opportunity: Record<string, unknown>,
  persistedPick: SerializedTopPick | null,
) {
  const { assetId, asset } = await loadOpportunityMediaAsset(opportunity, persistedPick);
  const sampleMovieUrl = persistedPick?.recommendedMediaUrl ?? undefined;
  await assertOpportunitySampleMovieTechnical(id, assetId, asset, sampleMovieUrl);
  requireOpportunitySampleMovieSource(asset);
  await assertOpportunitySampleMovieTrimAllowed(id, assetId, asset, sampleMovieUrl);
  return downloadTempVideo(asset.source_url);
}

async function recordPostedOpportunity(
  id: number,
  opportunity: Record<string, unknown>,
  persistedPick: SerializedTopPick | null,
  created: Awaited<ReturnType<typeof createXPost>>,
  postDate: string,
) {
  const logInput = buildXGrowthPostLogInput({
    opportunity,
    persistedPick,
    accountHandle: ACCOUNT,
    postDate,
  });
  const logResult = await saveXPostLog({
    ...logInput,
    xPostId: created.id,
    opportunityId: id,
    mediaAssetId: Number(opportunity.recommended_media_asset_id) || null,
  } as XPostLogInput);
  if (logResult.error) throw new Error(logResult.error.message);

  await supabaseAdmin.from("x_growth_opportunities").update({
    status: "posted",
    x_post_id: created.id,
    posted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  await invalidateTodayPlanWork(Number(opportunity.work_id));
  await auditXGrowth("x_post_created", { opportunityId: id, xPostId: created.id, mediaId: created.mediaId ?? null });
}

export async function executeOpportunityPost(id: number) {
  const { data, error } = await supabaseAdmin.from("x_growth_opportunities").select("*").eq("account_handle", ACCOUNT).eq("id", id).single();
  if (error || !data) return { error: error?.message ?? "Opportunity not found", postId: null as string | null };

  const opportunity = data as Record<string, unknown>;
  const persistedPick = ((opportunity.creative_genome as Record<string, unknown> | null)?.persisted_top_pick ?? null) as SerializedTopPick | null;
  let temp: Awaited<ReturnType<typeof downloadTempVideo>> | null = null;
  try {
    if (String(opportunity.media_type ?? "text") === "sample_movie") {
      temp = await downloadOpportunitySampleMovie(id, opportunity, persistedPick);
    }
    const created = await createXPost({ text: String(opportunity.post_text ?? ""), videoFile: temp?.file, videoContentType: temp?.contentType });
    await recordPostedOpportunity(id, opportunity, persistedPick, created, todayTokyo());
    return { error: null, postId: created.id };
  } catch (postError) {
    await auditXGrowth("x_post_failed", { opportunityId: id, error: postError instanceof Error ? postError.message : String(postError) });
    return { error: postError instanceof Error ? postError.message : "X post failed", postId: null };
  } finally {
    if (temp) await cleanupTempVideo(temp.dir);
  }
}
