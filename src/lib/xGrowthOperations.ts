import type { AffiliatePerformanceRow } from "@/lib/affiliateSalesAnalytics";
import type { FanzaXGrowth } from "@/lib/fanzaXAccountGrowth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanupTempVideo, createXPost, downloadTempVideo, fetchXPostPublicMetrics, getXApiCapabilityStatus, verifyXReadOnlyConnection } from "@/lib/xApi";
import { canTrimXMediaAsset, isUsableXMediaAsset, sourceDomain, sourceKindFor, validateTrimStartSeconds, X_GROWTH_ACCOUNT, type XMediaAsset } from "@/lib/xMediaAssets";
import type { XCreativeLearningRow, XPostLog, XPostLogInput } from "@/lib/xPostLogs";
import { saveXPostLog } from "@/lib/xPostLogs";
import type { XDailyMission, XDailyTopPick, XGrowthIntent, XGrowthOpportunity } from "@/lib/xGrowthOS";

export type XDailyPlanStatus = "draft" | "confirmed" | "completed" | "regenerated";
export type XOpportunityStatus = "candidate" | "adopted" | "rejected" | "posted" | "expired";
export type XSnapshotAge = "1h" | "6h" | "24h" | "72h";

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
  xMetricsConfigured: boolean;
  xReadOnlyConnection: {
    checked: boolean;
    ok: boolean;
    username: string | null;
    error: string | null;
  };
  requiredForPosting: string[];
  notes: string[];
};

const ACCOUNT = X_GROWTH_ACCOUNT;
const snapshotAges: XSnapshotAge[] = ["1h", "6h", "24h", "72h"];

function todayTokyo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function scoreBreakdown(item: XGrowthOpportunity) {
  return {
    reach: item.reachScore,
    follow: item.followScore,
    authority: item.authorityScore,
    revenue: item.revenueScore,
    creative_quality: item.creativeVariants?.map((variant) => ({
      id: variant.id,
      intent: variant.intent,
      total: variant.quality.total,
      passed: variant.quality.passed,
      dimensions: variant.quality.dimensions,
      gate: variant.quality.gate,
    })) ?? [],
  };
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.message?.includes("Could not find") || error?.message?.includes("schema cache");
}

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
    xMetricsConfigured: capability.metricsConfigured,
    xReadOnlyConnection: { checked: false, ok: false, username: null, error: null },
    requiredForPosting: capability.requiredForPosting,
    notes: capability.notes,
  };
}

export async function checkXReadOnlyConnectionStatus() {
  const capability = getXApiCapabilityStatus();
  if (!capability.metricsConfigured) {
    return { checked: false, ok: false, username: null, error: "X_BEARER_TOKEN or X_USER_ACCESS_TOKEN is not configured." };
  }
  try {
    const identity = await verifyXReadOnlyConnection();
    return {
      checked: true,
      ok: identity.username === ACCOUNT,
      username: identity.username,
      error: identity.username === ACCOUNT ? null : `Connected X API identity lookup returned ${identity.username ?? "unknown"}.`,
    };
  } catch (error) {
    return {
      checked: true,
      ok: false,
      username: null,
      error: error instanceof Error ? error.message : "X read-only connection failed.",
    };
  }
}

export async function auditXGrowth(action: string, detail: Record<string, unknown>) {
  await supabaseAdmin.from("x_growth_audit_logs").insert({
    account_handle: ACCOUNT,
    action,
    detail,
  });
}

export async function fetchMediaAssets(workIds: number[]) {
  const ids = [...new Set(workIds)].filter(Boolean);
  if (!ids.length) return { assets: new Map<number, XMediaAsset>(), error: null as string | null };
  const { data, error } = await supabaseAdmin
    .from("x_media_assets")
    .select("id,account_handle,work_id,product_id,media_type,source_url,source_domain,source_kind,mime_type,content_length,fetch_status,fetch_status_code,last_checked_at,rights_status,rights_basis_type,rights_basis_url,evidence_ref,rights_basis_note,reviewed_at,reviewed_by,review_source,x_usage_allowed,can_reupload,can_modify,quote_only,commercial_use_allowed,media_quality,manual_tags,trim_start_seconds,trim_reviewed_at,trim_reviewed_by,trim_review_source,trim_modify_confirmed,trim_note,notes")
    .eq("account_handle", ACCOUNT)
    .in("work_id", ids);
  if (error) return { assets: new Map<number, XMediaAsset>(), error: error.message };
  const map = new Map<number, XMediaAsset>();
  for (const asset of (data ?? []) as XMediaAsset[]) {
    if (!asset.work_id || (asset.media_type !== "sample_movie" && asset.media_type !== "video")) continue;
    const current = map.get(asset.work_id);
    const currentUsable = isUsableXMediaAsset(current).usable;
    const nextUsable = isUsableXMediaAsset(asset).usable;
    const currentStrong = current?.media_quality === "strong" && (current.manual_tags ?? []).includes("first_seconds_strong");
    const nextStrong = asset.media_quality === "strong" && (asset.manual_tags ?? []).includes("first_seconds_strong");
    if (!current || (nextUsable && !currentUsable) || (nextUsable === currentUsable && nextStrong && !currentStrong)) map.set(asset.work_id, asset);
  }
  return { assets: map, error: null };
}

export function applyMediaRights(opportunities: XGrowthOpportunity[], assets: Map<number, XMediaAsset>) {
  return opportunities.map((item) => {
    const asset = assets.get(item.workId);
    const verdict = isUsableXMediaAsset(asset);
    if (item.mediaType !== "sample_movie") return { ...item, mediaUsage: "allowed" as const, canNativeVideo: verdict.usable, mediaAsset: asset ?? null };
    return {
      ...item,
      mediaUsage: verdict.usable ? "allowed" as const : "rights_unchecked" as const,
      canNativeVideo: verdict.usable,
      mediaAsset: asset ?? null,
      mediaDecision: verdict.usable ? item.mediaDecision : `動画は${verdict.reasons.join(" / ") || "rights未確認"}のため未使用`,
    };
  });
}

export async function syncSampleMovieAssets(batchSize = 250) {
  const safeLimit = Math.max(1, Math.min(batchSize, 500));
  const { data, error } = await supabaseAdmin
    .from("works")
    .select("id,product_id,sample_movie_url")
    .not("sample_movie_url", "is", null)
    .neq("sample_movie_url", "")
    .order("id", { ascending: true })
    .limit(safeLimit);
  if (error) return { error: error.message, scanned: 0, synced: 0 };
  const rows = ((data ?? []) as Array<{ id: number; product_id: string | null; sample_movie_url: string | null }>)
    .filter((work) => work.sample_movie_url)
    .map((work) => ({
      account_handle: ACCOUNT,
      work_id: work.id,
      product_id: work.product_id,
      media_type: "video",
      source_url: work.sample_movie_url as string,
      source_domain: sourceDomain(work.sample_movie_url as string),
      source_kind: sourceKindFor(work.sample_movie_url as string),
      rights_status: "unknown",
      x_usage_allowed: false,
      can_reupload: false,
      can_modify: false,
      quote_only: true,
      commercial_use_allowed: false,
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) return { error: null, scanned: 0, synced: 0 };
  const result = await supabaseAdmin.from("x_media_assets").upsert(rows, { onConflict: "account_handle,work_id,source_url" });
  if (!result.error) await auditXGrowth("media_assets_synced", { scanned: data?.length ?? 0, synced: rows.length, batchSize: safeLimit });
  return { error: result.error?.message ?? null, scanned: data?.length ?? 0, synced: result.error ? 0 : rows.length };
}

async function probeUrl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
    if (response.status === 405) response = await fetch(url, { method: "GET", headers: { Range: "bytes=0-2047" }, redirect: "manual", signal: controller.signal });
    const status = response.status;
    const fetchStatus = status >= 300 && status < 400 ? "redirect" : status === 401 || status === 403 ? "forbidden" : status >= 200 && status < 300 ? "ok" : status >= 400 ? "dead" : "unknown";
    return {
      fetch_status: fetchStatus,
      fetch_status_code: status,
      mime_type: response.headers.get("content-type"),
      content_length: Number(response.headers.get("content-length")) || null,
      last_checked_at: new Date().toISOString(),
    };
  } catch {
    return { fetch_status: "unknown", fetch_status_code: null, mime_type: null, content_length: null, last_checked_at: new Date().toISOString() };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkMediaAssetUrls(batchSize = 50) {
  const safeLimit = Math.max(1, Math.min(batchSize, 100));
  const { data, error } = await supabaseAdmin
    .from("x_media_assets")
    .select("id,source_url")
    .eq("account_handle", ACCOUNT)
    .in("media_type", ["video", "sample_movie"])
    .or("last_checked_at.is.null,fetch_status.eq.unknown,fetch_status.eq.unchecked")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(safeLimit);
  if (error) return { error: error.message, checked: 0 };
  const assets = (data ?? []) as Array<{ id: number; source_url: string }>;
  let checked = 0;
  for (const asset of assets) {
    const probe = await probeUrl(asset.source_url);
    await supabaseAdmin.from("x_media_assets").update(probe).eq("account_handle", ACCOUNT).eq("id", asset.id);
    checked += 1;
  }
  if (checked) await auditXGrowth("media_asset_urls_checked", { checked, batchSize: safeLimit });
  return { error: null, checked };
}

export async function reviewMediaAsset(input: {
  id: number;
  status: "review" | "allowed" | "blocked";
  rightsBasisType?: string;
  rightsBasisUrl?: string;
  rightsBasisNote?: string;
  mediaQuality?: "unreviewed" | "strong" | "normal" | "weak";
  manualTags?: string[];
  reviewedBy?: string;
  reviewSource?: string;
}) {
  const beforeResult = await supabaseAdmin.from("x_media_assets").select("*").eq("account_handle", ACCOUNT).eq("id", input.id).single();
  if (beforeResult.error || !beforeResult.data) return { error: beforeResult.error?.message ?? "素材が見つかりません。" };
  if (input.status === "allowed" && (!input.rightsBasisType || (!input.rightsBasisUrl && !input.rightsBasisNote))) {
    return { error: "allowedには権利根拠の種類とURLまたはメモが必要です。" };
  }
  const update = {
    rights_status: input.status,
    rights_basis_type: input.rightsBasisType ?? (input.status === "blocked" ? "insufficient_evidence" : null),
    rights_basis_url: input.rightsBasisUrl ?? null,
    evidence_ref: input.rightsBasisUrl ?? null,
    rights_basis_note: input.rightsBasisNote ?? "",
    reviewed_at: new Date().toISOString(),
    reviewed_by: input.reviewedBy ?? "admin_x_growth",
    review_source: input.reviewSource ?? "admin",
    x_usage_allowed: input.status === "allowed",
    can_reupload: input.status === "allowed",
    can_modify: false,
    quote_only: input.status !== "allowed",
    commercial_use_allowed: input.status === "allowed",
    media_quality: input.mediaQuality ?? "unreviewed",
    manual_tags: input.manualTags ?? [],
  };
  const result = await supabaseAdmin.from("x_media_assets").update(update).eq("account_handle", ACCOUNT).eq("id", input.id);
  if (!result.error) await auditXGrowth("media_rights_reviewed", { mediaAssetId: input.id, old: beforeResult.data, new: update });
  return { error: result.error?.message ?? null };
}

export async function updateMediaAssetTrim(input: {
  id: number;
  trimStartSeconds: number;
  trimNote?: string;
  trimModifyConfirmed?: boolean;
  reviewedBy?: string;
  reviewSource?: string;
}) {
  const beforeResult = await supabaseAdmin.from("x_media_assets").select("*").eq("account_handle", ACCOUNT).eq("id", input.id).single();
  if (beforeResult.error || !beforeResult.data) return { error: beforeResult.error?.message ?? "素材が見つかりません。" };
  const validation = validateTrimStartSeconds(input.trimStartSeconds);
  if (!validation.ok) return { error: validation.error };
  const update = {
    trim_start_seconds: validation.value,
    trim_reviewed_at: new Date().toISOString(),
    trim_reviewed_by: input.reviewedBy ?? "admin_x_growth",
    trim_review_source: input.reviewSource ?? "manual_video_reviewed",
    trim_modify_confirmed: input.trimModifyConfirmed === true,
    trim_note: input.trimNote ?? "",
  };
  const result = await supabaseAdmin.from("x_media_assets").update(update).eq("account_handle", ACCOUNT).eq("id", input.id);
  if (!result.error) await auditXGrowth("media_trim_reviewed", { mediaAssetId: input.id, old: beforeResult.data, new: update });
  return { error: result.error?.message ?? null, trimStartSeconds: validation.value };
}

export async function persistOpportunities(items: XGrowthOpportunity[]) {
  if (!items.length) return { rows: [] as PersistedOpportunity[], error: null as string | null };
  const rows = items.map((item) => ({
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
    post_text: item.postText,
    reply_text: item.replyText,
    post_intent: item.postIntent,
    media_type: item.mediaType,
    recommended_media_asset_id: "mediaAsset" in item ? (item.mediaAsset as XMediaAsset | null)?.id ?? null : null,
    score_breakdown: scoreBreakdown(item),
    creative_genome: {
      ...item.creativeGenome,
      source_type: item.sourceType,
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
  }));
  const { data, error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .upsert(rows, { onConflict: "account_handle,opportunity_key,opportunity_date" })
    .select("id,status,opportunity_key,recommended_media_asset_id");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as PersistedOpportunity[], error: null };
}

export function buildStrategicMission(growth: FanzaXGrowth, outcomes: XPostLog[], persistedLearning: XCreativeLearningRow[]): XDailyMission {
  const profileRate = growth.impressions30d > 0 ? growth.profileVisits30d / growth.impressions30d : 0;
  const followRate = growth.profileVisits30d > 0 ? growth.newFollows30d / growth.profileVisits30d : 0;
  const siteRate = growth.impressions30d > 0 ? growth.xPageViews30d / growth.impressions30d : 0;
  const affiliateRate = growth.xPageViews30d > 0 ? growth.fanzaClicks30d / growth.xPageViews30d : 0;
  const lastMoney = outcomes.filter((log) => log.post_intent === "work_link").slice(0, 20);
  const weakMoney = lastMoney.length >= 5 && growth.fanzaClicks30d < lastMoney.length;
  const weak: XGrowthIntent = growth.impressions30d < 1000 ? "REACH"
    : profileRate < 0.015 ? "AUTHORITY"
      : followRate < 0.08 ? "FOLLOW"
        : siteRate < 0.01 || affiliateRate < 0.08 || weakMoney ? "MONEY"
          : "CONVERSATION";
  const mixes: Record<XGrowthIntent, Record<XGrowthIntent, number>> = {
    REACH: { REACH: 3, AUTHORITY: 1, FOLLOW: 0, CONVERSATION: 1, MONEY: 1 },
    AUTHORITY: { REACH: 1, AUTHORITY: 3, FOLLOW: 1, CONVERSATION: 1, MONEY: 1 },
    FOLLOW: { REACH: 1, AUTHORITY: 2, FOLLOW: 2, CONVERSATION: 1, MONEY: 1 },
    MONEY: { REACH: 1, AUTHORITY: 1, FOLLOW: 0, CONVERSATION: 0, MONEY: 3 },
    CONVERSATION: { REACH: 1, AUTHORITY: 1, FOLLOW: 1, CONVERSATION: 2, MONEY: 1 },
  };
  const label: Record<XGrowthIntent, XDailyMission["bottleneck"]> = {
    REACH: "Reach不足",
    AUTHORITY: "Profile Visit不足",
    FOLLOW: "Follow不足",
    MONEY: "収益導線不足",
    CONVERSATION: "会話接点不足",
  };
  const strongest = persistedLearning[0]?.label;
  return {
    bottleneck: label[weak],
    title: `明日は${weak}を最優先にする`,
    reason: `直近実績から ${weak} が最も弱い配分です。${strongest ? `勝ち寄りの ${strongest} は維持します。` : "十分な学習データがないため、結果取得を優先します。"}`,
    mix: mixes[weak],
    actions: [
      { intent: weak, label: `${weak}枠を増やす`, detail: "採用候補と投稿結果を同じopportunityに紐付けて翌日判断に使う" },
      { intent: "MONEY" as XGrowthIntent, label: "既存リンク画像は維持", detail: "画像は変えず、文面と投稿タイミングだけ比較する" },
      { intent: "CONVERSATION" as XGrowthIntent, label: "会話は人間確認", detail: "候補化まで。無差別返信や自動返信は行わない" },
    ],
  };
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

type SerializedTopPick = {
  key: string;
  workId: number;
  productId: string;
  title: string;
  url: string;
  pickOrder: number;
  role: XGrowthIntent;
  intent: XGrowthIntent;
  sourceType: XGrowthOpportunity["sourceType"];
  creativeAngle: XGrowthOpportunity["creativeAngle"];
  postText: string;
  replyText: string | null;
  mediaType: XGrowthOpportunity["mediaType"];
  mediaUsage: XGrowthOpportunity["mediaUsage"];
  canNativeVideo: boolean;
  recommendedMediaUrl: string | null;
  recommendedTimeLabel: string;
  whyToday: string[];
  whyBuzz: string;
  mediaDecision: string;
  alternativeReason: string | null;
  dailyScore: number;
  sourceEvidence: string[];
  setDiversity: XDailyTopPick["setDiversity"];
    mediaAsset: {
    id: number | undefined;
    work_id: number | null | undefined;
    source_url: string | undefined;
    media_quality: XMediaAsset["media_quality"] | null | undefined;
    manual_tags: NonNullable<XMediaAsset["manual_tags"]>;
    review_source: string | null | undefined;
    x_usage_allowed: boolean | undefined;
    rights_status: XMediaAsset["rights_status"] | undefined;
    can_modify: boolean | undefined;
    trim_start_seconds: number | null | undefined;
    trim_reviewed_at: string | null | undefined;
    trim_modify_confirmed: boolean | undefined;
    trim_note: string | null | undefined;
  } | null;
  selectedVariant: {
    id: string;
    quality: XDailyTopPick["creativeVariants"][number]["quality"];
    buzzPotential: XDailyTopPick["creativeVariants"][number]["buzzPotential"];
    mediaType: XDailyTopPick["creativeVariants"][number]["mediaType"];
    linkPlan: XDailyTopPick["creativeVariants"][number]["linkPlan"];
    hookDirection: XDailyTopPick["creativeVariants"][number]["hookDirection"];
    hookType: XDailyTopPick["creativeVariants"][number]["hookType"];
  } | null;
};

function serializeTopPick(item: XDailyTopPick): SerializedTopPick {
  const variant = item.creativeVariants.find((creative) => creative.id === item.creativeVariantId) ?? item.creativeVariants[0];
  return {
    key: item.key,
    workId: item.workId,
    productId: item.productId,
    title: item.title,
    url: variant?.url ?? `/works/${item.workId}`,
    pickOrder: item.pickOrder,
    role: item.role,
    intent: item.intent,
    sourceType: item.sourceType,
    creativeAngle: item.creativeAngle,
    postText: item.postText,
    replyText: item.replyText,
    mediaType: item.mediaType,
    mediaUsage: item.mediaUsage,
    canNativeVideo: item.canNativeVideo,
    recommendedMediaUrl: item.recommendedMediaUrl,
    recommendedTimeLabel: item.recommendedTimeLabel,
    whyToday: item.whyToday,
    whyBuzz: item.whyBuzz,
    mediaDecision: item.mediaDecision,
    alternativeReason: item.alternativeReason,
    dailyScore: item.dailyScore,
    sourceEvidence: item.sourceEvidence,
    setDiversity: item.setDiversity,
    mediaAsset: item.mediaAsset ? {
      id: item.mediaAsset.id,
      work_id: item.mediaAsset.work_id,
      source_url: item.mediaAsset.source_url,
      media_quality: item.mediaAsset.media_quality,
      manual_tags: item.mediaAsset.manual_tags ?? [],
      review_source: item.mediaAsset.review_source,
      x_usage_allowed: item.mediaAsset.x_usage_allowed,
      rights_status: item.mediaAsset.rights_status,
      can_modify: item.mediaAsset.can_modify,
      trim_start_seconds: item.mediaAsset.trim_start_seconds ?? 0,
      trim_reviewed_at: item.mediaAsset.trim_reviewed_at,
      trim_modify_confirmed: item.mediaAsset.trim_modify_confirmed,
      trim_note: item.mediaAsset.trim_note,
    } : null,
    selectedVariant: variant ? {
      id: variant.id,
      quality: variant.quality,
      buzzPotential: variant.buzzPotential,
      mediaType: variant.mediaType,
      linkPlan: variant.linkPlan,
      hookDirection: variant.hookDirection,
      hookType: variant.hookType,
    } : null,
  };
}

export type PersistedXDailyPlan = {
  id: number;
  account_handle: string;
  plan_date: string;
  primary_bottleneck: string;
  mission_title: string;
  mission_reason: string;
  target_mix: Record<string, number>;
  recommended_actions: Array<{ intent: XGrowthIntent; label: string; detail: string }>;
  status: XDailyPlanStatus;
  top_picks: SerializedTopPick[];
  supply_diagnostics: Record<string, unknown>;
  native_x_learning: Record<string, unknown>;
  performance_timings: Record<string, number>;
  generated_at: string | null;
  stale_reason: string | null;
};

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
  return { plan: data as PersistedXDailyPlan | null, error: null as string | null };
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
  const topPicks: SerializedTopPick[] = rows.map((row, index) => {
    const genome = (row.creative_genome ?? {}) as Record<string, unknown>;
    const pick = (genome.persisted_top_pick ?? {}) as Partial<SerializedTopPick>;
    const fallbackAsset = row.recommended_media_asset_id ? {
      id: Number(row.recommended_media_asset_id),
      work_id: row.work_id ? Number(row.work_id) : null,
      source_url: undefined,
      media_quality: undefined,
      manual_tags: [],
      review_source: undefined,
      x_usage_allowed: undefined,
      rights_status: undefined,
      can_modify: undefined,
      trim_start_seconds: 0,
      trim_reviewed_at: undefined,
      trim_modify_confirmed: undefined,
      trim_note: undefined,
    } : null;
    return {
      ...pick,
      key: String(row.opportunity_key),
      workId: Number(row.work_id),
      productId: String(row.product_id ?? ""),
      title: String(row.topic ?? pick.title ?? ""),
      url: pick.url ?? `/works/${row.work_id}`,
      pickOrder: Number(pick.pickOrder ?? index + 1),
      role: String(row.intent) as XGrowthIntent,
      intent: String(row.intent) as XGrowthIntent,
      sourceType: pick.sourceType ?? "WORK",
      creativeAngle: pick.creativeAngle ?? "VIDEO_FIRST",
      postText: String(row.post_text ?? ""),
      replyText: row.reply_text ? String(row.reply_text) : null,
      mediaType: String(row.media_type) as SerializedTopPick["mediaType"],
      mediaUsage: pick.mediaUsage ?? "allowed",
      canNativeVideo: Boolean(pick.canNativeVideo),
      recommendedMediaUrl: pick.recommendedMediaUrl ?? null,
      recommendedTimeLabel: pick.recommendedTimeLabel ?? "",
      whyToday: pick.whyToday ?? [],
      whyBuzz: pick.whyBuzz ?? String(row.adoption_reason ?? ""),
      mediaDecision: pick.mediaDecision ?? "",
      alternativeReason: pick.alternativeReason ?? null,
      dailyScore: pick.dailyScore ?? 0,
      sourceEvidence: pick.sourceEvidence ?? [],
      setDiversity: pick.setDiversity ?? {
        status: "OK",
        roleLabel: "",
        signature: {
          openingPattern: "",
          sentenceStructure: "",
          judgmentPhrase: "",
          subjectStructure: "",
          intent: String(row.intent) as XGrowthIntent,
          sourceType: pick.sourceType ?? "WORK",
          hookType: "",
          emotionalAngle: "",
          mediaType: String(row.media_type) as SerializedTopPick["mediaType"],
          ctaStrategy: "",
          linkStrategy: "",
        },
        reasons: [],
      },
      mediaAsset: pick.mediaAsset ?? fallbackAsset,
      selectedVariant: pick.selectedVariant ?? null,
    };
  });
  return {
    plan: {
      id: Number((plan as Record<string, unknown> | null)?.id ?? 0),
      account_handle: ACCOUNT,
      plan_date: todayTokyo(),
      primary_bottleneck: String((plan as Record<string, unknown> | null)?.primary_bottleneck ?? ""),
      mission_title: String((plan as Record<string, unknown> | null)?.mission_title ?? "今日のTop Picks"),
      mission_reason: String((plan as Record<string, unknown> | null)?.mission_reason ?? "保存済みTop Picksを表示しています。"),
      target_mix: ((plan as Record<string, unknown> | null)?.target_mix ?? {}) as Record<string, number>,
      recommended_actions: ((plan as Record<string, unknown> | null)?.recommended_actions ?? []) as PersistedXDailyPlan["recommended_actions"],
      status: ((plan as Record<string, unknown> | null)?.status ?? "draft") as XDailyPlanStatus,
      top_picks: topPicks,
      supply_diagnostics: ((rows[0]?.creative_genome as Record<string, unknown> | undefined)?.supply_diagnostics ?? {}) as Record<string, unknown>,
      native_x_learning: ((rows[0]?.creative_genome as Record<string, unknown> | undefined)?.native_x_learning ?? {}) as Record<string, unknown>,
      performance_timings: ((rows[0]?.creative_genome as Record<string, unknown> | undefined)?.performance_timings ?? {}) as Record<string, number>,
      generated_at: rows[0]?.updated_at ? String(rows[0].updated_at) : null,
      stale_reason: staleReason,
    },
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
      post_text: item.postText,
      reply_text: item.replyText,
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

export async function updateOpportunityStatus(id: number, status: XOpportunityStatus, reason?: string) {
  const { error } = await supabaseAdmin
    .from("x_growth_opportunities")
    .update({ status, adoption_reason: reason ?? null, updated_at: new Date().toISOString() })
    .eq("account_handle", ACCOUNT)
    .eq("id", id);
  if (!error) {
    if (status === "adopted") {
      const { data } = await supabaseAdmin
        .from("x_growth_opportunities")
        .select("opportunity_key,work_id,topic,intent,creative_genome")
        .eq("account_handle", ACCOUNT)
        .eq("id", id)
        .single();
      const row = data as Record<string, unknown> | null;
      const genome = (row?.creative_genome ?? {}) as Record<string, unknown>;
      await supabaseAdmin.from("x_creative_learning").insert({
        account_handle: ACCOUNT,
        post_key: row?.opportunity_key ?? null,
        work_id: row?.work_id ?? null,
        topic: String(row?.topic ?? "adopted creative"),
        intent: String(row?.intent ?? "FOLLOW"),
        hook: String(genome.hook ?? "unknown"),
        proof: String(genome.proof ?? "unknown"),
        structure: String(genome.structure ?? "unknown"),
        emotion: String(genome.emotion ?? "unknown"),
        length_bucket: String(genome.length ?? "unknown"),
        media: String(genome.media ?? "unknown"),
        cta: String(genome.cta ?? "unknown"),
        link_strategy: String(genome.linkStrategy ?? genome.link_strategy ?? "unknown"),
        posting_slot: String(genome.postingSlot ?? genome.posting_slot ?? "unknown"),
        outcome_summary: { source: "admin_adoption", opportunity_id: id },
        learning_note: "採用時点のCreative Genome。実績取得後に結果で上書き評価する。",
      });
    }
    await auditXGrowth("opportunity_status", { id, status, reason: reason ?? null });
  }
  return { error: error?.message ?? null };
}

export async function executeOpportunityPost(id: number) {
  const { data, error } = await supabaseAdmin.from("x_growth_opportunities").select("*").eq("account_handle", ACCOUNT).eq("id", id).single();
  if (error || !data) return { error: error?.message ?? "Opportunity not found", postId: null as string | null };
  const opportunity = data as Record<string, unknown>;
  const mediaType = String(opportunity.media_type ?? "text");
  let temp: { dir: string; file: string; contentType: string } | null = null;
  try {
    if (mediaType === "sample_movie") {
      const assetId = Number(opportunity.recommended_media_asset_id);
      if (!Number.isSafeInteger(assetId)) throw new Error("Native Video requires a rights-checked media asset.");
      const assetResult = await supabaseAdmin.from("x_media_assets").select("*").eq("account_handle", ACCOUNT).eq("id", assetId).single();
      const asset = assetResult.data as XMediaAsset | null;
      if (assetResult.error || !asset) throw new Error(assetResult.error?.message ?? "Media asset not found.");
      const verdict = isUsableXMediaAsset(asset);
      if (!verdict.usable) {
        await auditXGrowth("media_rights_blocked", { opportunityId: id, mediaAssetId: assetId, reasons: verdict.reasons });
        throw new Error("Media rights are not sufficient for native video posting.");
      }
      if (Number(asset.trim_start_seconds ?? 0) > 0) {
        const trimVerdict = canTrimXMediaAsset(asset);
        if (!trimVerdict.usable) {
          await auditXGrowth("media_trim_blocked", { opportunityId: id, mediaAssetId: assetId, reasons: trimVerdict.reasons });
          throw new Error(`トリム動画は使えません: ${trimVerdict.reasons.join(" / ")}`);
        }
      }
      temp = await downloadTempVideo(asset.source_url);
    }
    const created = await createXPost({ text: String(opportunity.post_text ?? ""), videoFile: temp?.file, videoContentType: temp?.contentType });
    const postDate = todayTokyo();
    const logInput: XPostLogInput = {
      postKey: String(opportunity.opportunity_key),
      workId: Number(opportunity.work_id),
      category: "score",
      title: String(opportunity.topic).slice(0, 300),
      postText: String(opportunity.post_text),
      postDate,
      accountHandle: ACCOUNT,
      postIntent: "work_link",
      scheduledSlot: null,
      plannedAt: null,
      creativeVariantId: String(opportunity.opportunity_key),
    };
    const logResult = await saveXPostLog({ ...logInput, xPostId: created.id, opportunityId: id, mediaAssetId: Number(opportunity.recommended_media_asset_id) || null } as XPostLogInput);
    if (logResult.error) throw new Error(logResult.error.message);
    await supabaseAdmin.from("x_growth_opportunities").update({ status: "posted", x_post_id: created.id, posted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    await auditXGrowth("x_post_created", { opportunityId: id, xPostId: created.id, mediaId: created.mediaId ?? null });
    return { error: null, postId: created.id };
  } catch (postError) {
    await auditXGrowth("x_post_failed", { opportunityId: id, error: postError instanceof Error ? postError.message : String(postError) });
    return { error: postError instanceof Error ? postError.message : "X post failed", postId: null };
  } finally {
    if (temp) await cleanupTempVideo(temp.dir);
  }
}

export async function syncMetricSnapshots(age: XSnapshotAge) {
  if (!snapshotAges.includes(age)) return { error: "Invalid snapshot age", saved: 0 };
  const { data, error } = await supabaseAdmin
    .from("x_post_logs")
    .select("id,post_key,work_id,posted_at,x_post_id")
    .eq("account_handle", ACCOUNT)
    .not("x_post_id", "is", null)
    .limit(100);
  if (error) return { error: error.message, saved: 0 };
  const logs = (data ?? []) as Array<{ id: number; post_key: string; work_id: number; posted_at: string; x_post_id: string | null }>;
  const metrics = await fetchXPostPublicMetrics(logs.map((log) => log.x_post_id).filter((id): id is string => Boolean(id)));
  const rows = [];
  for (const log of logs) {
    const postedAt = new Date(log.posted_at).getTime();
    const hours = { "1h": 1, "6h": 6, "24h": 24, "72h": 72 }[age];
    if (Date.now() < postedAt + hours * 60 * 60 * 1000) continue;
    const since = new Date(postedAt).toISOString();
    const until = new Date(postedAt + hours * 60 * 60 * 1000).toISOString();
    const [views, clicks] = await Promise.all([
      supabaseAdmin.from("work_page_views").select("id", { count: "exact", head: true }).eq("source_page", "x").eq("x_post_key", log.post_key).gte("viewed_at", since).lte("viewed_at", until),
      supabaseAdmin.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("source_page", "x").eq("x_post_key", log.post_key).gte("clicked_at", since).lte("clicked_at", until),
    ]);
    const publicMetric = log.x_post_id ? metrics.get(log.x_post_id) : null;
    rows.push({
      account_handle: ACCOUNT,
      x_post_log_id: log.id,
      post_key: log.post_key,
      snapshot_age: age,
      source: "x_api",
      impressions: publicMetric?.impressions ?? 0,
      likes: publicMetric?.likes ?? 0,
      replies: publicMetric?.replies ?? 0,
      reposts: publicMetric?.reposts ?? 0,
      site_visits: views.count ?? 0,
      affiliate_clicks: clicks.count ?? 0,
      captured_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return { error: null, saved: 0 };
  const result = await supabaseAdmin.from("x_metric_snapshots").upsert(rows, { onConflict: "post_key,snapshot_age" });
  return { error: result.error?.message ?? null, saved: result.error ? 0 : rows.length };
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

  const grouped = new Map<number, Array<{ ranking: number; captured_date: string; captured_at: string }>>();
  for (const row of (data ?? []) as Array<{ work_id: number; ranking: number; captured_date: string; captured_at: string }>) {
    if (!row.work_id || !row.ranking) continue;
    grouped.set(row.work_id, [...(grouped.get(row.work_id) ?? []), row]);
  }
  for (const [workId, rows] of grouped) {
    const byDate = new Map<string, { ranking: number; captured_at: string }>();
    for (const row of rows) {
      const current = byDate.get(row.captured_date);
      if (!current || row.captured_at > current.captured_at) byDate.set(row.captured_date, { ranking: row.ranking, captured_at: row.captured_at });
    }
    const ordered = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    histories.set(workId, { observations: ordered.length, previousRanking: ordered[1]?.[1].ranking ?? null });
  }
  return { histories, error: null };
}

export function buildSeriesIdeas(performance: AffiliatePerformanceRow[], opportunities: XGrowthOpportunity[]) {
  const ideas = opportunities.filter((item) => item.isNinetyDayLow || item.xPageViews >= 3 || item.ranking && item.ranking <= 50).slice(0, 8).map((item) => ({
    key: `series-${item.key}`,
    title: item.isNinetyDayLow ? "今週の過去最安" : item.xPageViews >= 3 ? "24時間急上昇候補" : "今日の異常値",
    detail: `${item.title} / ${item.evidence.slice(0, 2).join(" / ")}`,
  }));
  if (ideas.length) return ideas;
  return performance.filter((row) => row.salesCount > 0).slice(0, 4).map((row) => ({
    key: `sales-follow-${row.workId}`,
    title: "昨日の注目作その後",
    detail: `販売実績がある作品ID ${row.workId} を続報候補として確認`,
  }));
}
