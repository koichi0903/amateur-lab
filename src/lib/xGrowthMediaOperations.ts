import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFanzaXGrowthTechnicalSampleMovie, sourceDomain, sourceKindFor, X_GROWTH_ACCOUNT, type XMediaAsset } from "@/lib/xMediaAssets";
import type { XGrowthOpportunity } from "@/lib/xGrowthOS";
import { buildVisualVideoFacts } from "@/lib/xVisualVideoFacts";
import { analyzeSampleMovie, videoSourceFingerprint, VIDEO_ANALYSIS_VERSION } from "@/lib/xVideoAnalysis";
import { buildXMediaAssetReviewPlan, type XMediaAssetReviewInput } from "@/lib/xGrowthMediaReview";
import { buildXMediaAssetTrimReviewPlan } from "@/lib/xGrowthMediaTrimReview";
import { selectPreferredXMediaAssetsByWork } from "@/lib/xGrowthMediaAssetSelection";
import { classifyVideoAnalysisAsset } from "@/lib/xGrowthVideoAnalysisEligibility";
import { projectXGrowthMediaEligibility } from "@/lib/xGrowthMediaEligibility";

const ACCOUNT = X_GROWTH_ACCOUNT;
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
  const selectWithFacts = "id,account_handle,work_id,product_id,media_type,source_url,source_domain,source_kind,mime_type,content_length,fetch_status,fetch_status_code,last_checked_at,rights_status,rights_basis_type,rights_basis_url,evidence_ref,rights_basis_note,reviewed_at,reviewed_by,review_source,x_usage_allowed,can_reupload,can_modify,quote_only,commercial_use_allowed,media_quality,manual_tags,trim_start_seconds,trim_reviewed_at,trim_reviewed_by,trim_review_source,trim_modify_confirmed,trim_note,notes,visual_video_facts,video_analysis_version,video_analysis_source_fingerprint,video_analyzed_at,video_raw_metrics,video_analysis_diagnostics";
  const selectWithoutFacts = "id,account_handle,work_id,product_id,media_type,source_url,source_domain,source_kind,mime_type,content_length,fetch_status,fetch_status_code,last_checked_at,rights_status,rights_basis_type,rights_basis_url,evidence_ref,rights_basis_note,reviewed_at,reviewed_by,review_source,x_usage_allowed,can_reupload,can_modify,quote_only,commercial_use_allowed,media_quality,manual_tags,trim_start_seconds,trim_reviewed_at,trim_reviewed_by,trim_review_source,trim_modify_confirmed,trim_note,notes";
  const primary = await supabaseAdmin
    .from("x_media_assets")
    .select(selectWithFacts)
    .eq("account_handle", ACCOUNT)
    .in("work_id", ids);
  let data = primary.data as unknown as XMediaAsset[] | null;
  let error = primary.error;
  if (error && (error.code === "42703" || error.message.includes("schema cache"))) {
    const fallback = await supabaseAdmin.from("x_media_assets").select(selectWithoutFacts).eq("account_handle", ACCOUNT).in("work_id", ids);
    data = fallback.data as unknown as XMediaAsset[] | null;
    error = fallback.error;
  }
  if (error) return { assets: new Map<number, XMediaAsset>(), error: error.message };
  const map = selectPreferredXMediaAssetsByWork(
    (data ?? []) as XMediaAsset[],
    (asset) => isFanzaXGrowthTechnicalSampleMovie(asset, asset?.source_url).usable,
  );
  return { assets: map, error: null };
}

export async function analyzeUncachedVideoFacts(assets: Map<number, XMediaAsset>, limit = 24) {
  const started = Date.now(); let analyzed = 0; let reused = 0; const diagnostics: Array<{ workId: number | null; sourceUrl: string; status: string; detail?: string }> = [];
  for (const asset of [...assets.values()].slice(0, limit)) {
    const action = classifyVideoAnalysisAsset(
      asset,
      VIDEO_ANALYSIS_VERSION,
      asset.source_url ? videoSourceFingerprint(asset.source_url) : null,
    );
    if (action === "skip") continue;
    if (action === "reuse") { reused += 1; continue; }
    const jacketResult = asset.work_id ? await supabaseAdmin.from("works").select("image_url").eq("id", asset.work_id).maybeSingle() : { data: null };
    const result = await analyzeSampleMovie({ sourceUrl: asset.source_url, trimStartSeconds: asset.trim_start_seconds ?? 0, jacketUrl: (jacketResult.data as { image_url?: string | null } | null)?.image_url });
    const facts = buildVisualVideoFacts({ sampleMovieUrl: asset.source_url, videoEvidence: result.videoEvidence, jacketEvidence: result.jacketEvidence });
    const update = { visual_video_facts: facts, video_analysis_version: result.version, video_analysis_source_fingerprint: result.sourceFingerprint, video_analyzed_at: result.analyzedAt, video_raw_metrics: result.rawMetrics, video_analysis_diagnostics: result.diagnostics };
    const saved = await supabaseAdmin.from("x_media_assets").update(update).eq("account_handle", ACCOUNT).eq("id", asset.id);
    if (saved.error) diagnostics.push({ workId: asset.work_id, sourceUrl: asset.source_url, status: "persist_failed", detail: saved.error.message });
    else { Object.assign(asset, update); analyzed += 1; diagnostics.push({ workId: asset.work_id, sourceUrl: asset.source_url, status: result.videoEvidence.length ? "analyzed" : "no_usable_video_evidence", detail: result.diagnostics.join(" / ") }); }
  }
  return { analyzed, reused, elapsedMs: Date.now() - started, diagnostics };
}

export function applyMediaEligibility(opportunities: XGrowthOpportunity[], assets: Map<number, XMediaAsset>) {
  return opportunities.map((item) => projectXGrowthMediaEligibility(item, assets));
}

type SampleMovieWork = { id: number; product_id: string | null; sample_movie_url: string | null };

async function syncSampleMovieAssetRows(works: SampleMovieWork[]) {
  const candidates = works.filter((work) => work.sample_movie_url);
  if (!candidates.length) return { error: null, scanned: works.length, synced: 0, created: 0, existing: 0 };

  const ids = candidates.map((work) => work.id);
  const existingResult = await supabaseAdmin
    .from("x_media_assets")
    .select("work_id,source_url")
    .eq("account_handle", ACCOUNT)
    .in("work_id", ids)
    .in("media_type", ["video", "sample_movie"]);
  if (existingResult.error) return { error: existingResult.error.message, scanned: works.length, synced: 0, created: 0, existing: 0 };

  const existingKeys = new Set((existingResult.data ?? []).map((row) => `${row.work_id}:${row.source_url}`));
  const rows = candidates
    .filter((work) => !existingKeys.has(`${work.id}:${work.sample_movie_url}`))
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
  if (!rows.length) return { error: null, scanned: works.length, synced: 0, created: 0, existing: candidates.length };

  const result = await supabaseAdmin.from("x_media_assets").insert(rows);
  if (result.error) return { error: result.error.message, scanned: works.length, synced: 0, created: 0, existing: candidates.length - rows.length };
  await auditXGrowth("media_assets_synced", { scanned: works.length, synced: rows.length, created: rows.length, existing: candidates.length - rows.length });
  return { error: null, scanned: works.length, synced: rows.length, created: rows.length, existing: candidates.length - rows.length };
}

export async function syncSampleMovieAssetsForWorkIds(workIds: number[]) {
  const ids = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return { error: null, scanned: 0, synced: 0, created: 0, existing: 0 };
  const result = await supabaseAdmin.from("works").select("id,product_id,sample_movie_url").in("id", ids);
  if (result.error) return { error: result.error.message, scanned: 0, synced: 0, created: 0, existing: 0 };
  return syncSampleMovieAssetRows((result.data ?? []) as SampleMovieWork[]);
}

export async function syncSampleMovieAssets(batchSize = 250) {
  const safeLimit = Math.max(1, Math.min(batchSize, 500));
  const { data, error } = await supabaseAdmin
    .from("works")
    .select("id,product_id,sample_movie_url")
    .not("sample_movie_url", "is", null)
    .neq("sample_movie_url", "")
    // New works are the operational priority; old rows are handled by later batches.
    .order("id", { ascending: false })
    .limit(safeLimit);
  if (error) return { error: error.message, scanned: 0, synced: 0, created: 0, existing: 0 };
  return syncSampleMovieAssetRows((data ?? []) as SampleMovieWork[]);
}

async function probeUrl(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "manual", signal: controller.signal });
    if (response.status === 405) {
      response = await fetch(url, { method: "GET", headers: { Range: "bytes=0-2047" }, redirect: "manual", signal: controller.signal });
    }
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

export async function checkMediaAssetUrlsForWorkIds(workIds: number[], batchSize = 50) {
  const safeLimit = Math.max(1, Math.min(batchSize, 100));
  const ids = [...new Set(workIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  let query = supabaseAdmin
    .from("x_media_assets")
    .select("id,source_url")
    .eq("account_handle", ACCOUNT)
    .in("media_type", ["video", "sample_movie"])
    .or("last_checked_at.is.null,fetch_status.eq.unknown,fetch_status.eq.unchecked")
    .order("last_checked_at", { ascending: true, nullsFirst: true });
  if (ids.length) query = query.in("work_id", ids);
  const { data, error } = await query.limit(safeLimit);
  if (error) return { error: error.message, checked: 0 };
  const assets = (data ?? []) as Array<{ id: number; source_url: string }>;
  let checked = 0;
  for (const asset of assets) {
    const probe = await probeUrl(asset.source_url);
    const saved = await supabaseAdmin.from("x_media_assets").update({ ...probe, technical_status: probe.fetch_status }).eq("account_handle", ACCOUNT).eq("id", asset.id);
    if (saved.error) return { error: saved.error.message, checked };
    checked += 1;
  }
  if (checked) await auditXGrowth("media_asset_urls_checked", { checked, batchSize: safeLimit });
  return { error: null, checked };
}

export async function reviewMediaAsset(input: XMediaAssetReviewInput) {
  const beforeResult = await supabaseAdmin.from("x_media_assets").select("*").eq("account_handle", ACCOUNT).eq("id", input.id).single();
  if (beforeResult.error || !beforeResult.data) return { error: beforeResult.error?.message ?? "素材が見つかりません。" };
  const plan = buildXMediaAssetReviewPlan(input, new Date().toISOString());
  if (!plan.ok) return { error: plan.error };
  const result = await supabaseAdmin.from("x_media_assets").update(plan.update).eq("account_handle", ACCOUNT).eq("id", input.id);
  if (!result.error) await auditXGrowth("media_rights_reviewed", { mediaAssetId: input.id, old: beforeResult.data, new: plan.update });
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
  const existing = beforeResult.data as Partial<XMediaAsset>;
  const plan = buildXMediaAssetTrimReviewPlan(existing, input, new Date().toISOString());
  if (!plan.ok) return { error: plan.error };
  const result = await supabaseAdmin.from("x_media_assets").update(plan.update).eq("account_handle", ACCOUNT).eq("id", input.id);
  if (!result.error) await auditXGrowth("media_trim_reviewed", { mediaAssetId: input.id, old: beforeResult.data, new: plan.update });
  return { error: result.error?.message ?? null, trimStartSeconds: plan.trimStartSeconds };
}
