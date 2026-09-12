import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const X_GROWTH_ACCOUNT = "hakkutsu_lab";

export type XMediaRightsStatus = "unknown" | "review" | "allowed" | "blocked" | "unchecked" | "rejected" | "expired";
export type XMediaFetchStatus = "ok" | "dead" | "redirect" | "forbidden" | "unknown" | "unchecked";
export type XMediaQuality = "unreviewed" | "strong" | "normal" | "weak";
export type XMediaManualTag =
  | "first_seconds_strong"
  | "visual_mismatch"
  | "actress_fit"
  | "scene_surprise"
  | "safe_preview"
  | "too_explicit_for_reach"
  | "weak_visual";

export type XMediaAsset = {
  id: number;
  account_handle: string;
  work_id: number | null;
  product_id: string | null;
  media_type: string;
  source_url: string;
  source_domain: string | null;
  source_kind: string | null;
  mime_type: string | null;
  content_length: number | null;
  fetch_status: XMediaFetchStatus | null;
  fetch_status_code: number | null;
  last_checked_at: string | null;
  rights_status: XMediaRightsStatus;
  rights_basis_type: string | null;
  rights_basis_url: string | null;
  evidence_ref: string | null;
  rights_basis_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_source: string | null;
  x_usage_allowed: boolean;
  can_reupload: boolean;
  can_modify: boolean;
  quote_only: boolean;
  commercial_use_allowed: boolean;
  media_quality: XMediaQuality | null;
  manual_tags: XMediaManualTag[] | null;
  trim_start_seconds: number | null;
  trim_reviewed_at: string | null;
  trim_reviewed_by: string | null;
  trim_review_source: string | null;
  trim_modify_confirmed: boolean;
  trim_note: string | null;
  notes: string;
};

export type XMediaUsability = {
  usable: boolean;
  reasons: string[];
  reachSuitable: boolean;
  quality: "strong" | "normal" | "weak" | "unreviewed";
};

const blockedFetchStatuses = new Set(["dead", "forbidden"]);

export function normalizeRightsStatus(status: string | null | undefined): XMediaRightsStatus {
  if (status === "unchecked") return "unknown";
  if (status === "rejected" || status === "expired") return "blocked";
  if (status === "review" || status === "allowed" || status === "blocked" || status === "unknown") return status;
  return "unknown";
}

export function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "invalid";
  }
}

export function sourceKindFor(url: string) {
  const domain = sourceDomain(url);
  if (domain.endsWith("dmm.co.jp") || domain.endsWith("fanza.co.jp")) return "official_sample";
  return "unknown_external";
}

export function isUsableXMediaAsset(asset: Partial<XMediaAsset> | null | undefined): XMediaUsability {
  const reasons: string[] = [];
  if (!asset) reasons.push("rights未確認");
  const status = normalizeRightsStatus(asset?.rights_status);
  if (status !== "allowed") reasons.push(status === "blocked" ? "rights blocked" : "rights未確認");
  if (asset?.x_usage_allowed !== true) reasons.push("X usage不可");
  if (asset?.can_reupload !== true) reasons.push("reupload不可");
  if (asset?.quote_only === true) reasons.push("quote only");
  if (asset?.commercial_use_allowed !== true) reasons.push("commercial use未確認");
  if (asset?.fetch_status && blockedFetchStatuses.has(asset.fetch_status)) reasons.push(`URL ${asset.fetch_status}`);
  const quality = asset?.media_quality ?? "unreviewed";
  const tags = asset?.manual_tags ?? [];
  const reachSuitable = !tags.includes("too_explicit_for_reach") && quality !== "weak";
  if (!reachSuitable) reasons.push(tags.includes("too_explicit_for_reach") ? "reach不向き" : "weak video");
  return { usable: reasons.length === 0, reasons: [...new Set(reasons)], reachSuitable, quality };
}

export function validateTrimStartSeconds(value: unknown, durationSeconds?: number | null) {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds)) return { ok: false as const, error: "開始秒が不正です。" };
  const rounded = Math.round(seconds * 10) / 10;
  if (rounded < 0) return { ok: false as const, error: "開始秒は0以上にしてください。" };
  if (durationSeconds != null && Number.isFinite(durationSeconds) && rounded >= durationSeconds) {
    return { ok: false as const, error: "開始秒が動画の長さ以上です。" };
  }
  return { ok: true as const, value: rounded };
}

export function canTrimXMediaAsset(asset: Partial<XMediaAsset> | null | undefined) {
  const usability = isUsableXMediaAsset(asset);
  const reasons = [...usability.reasons];
  if (asset?.can_modify !== true && asset?.trim_modify_confirmed !== true) reasons.push("can_modifyまたは冒頭カット許可が未確認");
  return { usable: usability.usable && (asset?.can_modify === true || asset?.trim_modify_confirmed === true), reasons: [...new Set(reasons)] };
}

export async function getXMediaSupplyStatus() {
  const [
    works,
    synced,
    unknown,
    review,
    allowed,
    blocked,
    dead,
    waiting,
  ] = await Promise.all([
    supabaseAdmin.from("works").select("id", { count: "exact", head: true }).not("sample_movie_url", "is", null).neq("sample_movie_url", ""),
    supabaseAdmin.from("x_media_assets").select("id", { count: "exact", head: true }).eq("account_handle", X_GROWTH_ACCOUNT).in("media_type", ["video", "sample_movie"]),
    supabaseAdmin.from("x_media_assets").select("id", { count: "exact", head: true }).eq("account_handle", X_GROWTH_ACCOUNT).in("media_type", ["video", "sample_movie"]).eq("rights_status", "unknown"),
    supabaseAdmin.from("x_media_assets").select("id", { count: "exact", head: true }).eq("account_handle", X_GROWTH_ACCOUNT).in("media_type", ["video", "sample_movie"]).eq("rights_status", "review"),
    supabaseAdmin.from("x_media_assets").select("id", { count: "exact", head: true }).eq("account_handle", X_GROWTH_ACCOUNT).in("media_type", ["video", "sample_movie"]).eq("rights_status", "allowed"),
    supabaseAdmin.from("x_media_assets").select("id", { count: "exact", head: true }).eq("account_handle", X_GROWTH_ACCOUNT).in("media_type", ["video", "sample_movie"]).eq("rights_status", "blocked"),
    supabaseAdmin.from("x_media_assets").select("id", { count: "exact", head: true }).eq("account_handle", X_GROWTH_ACCOUNT).in("media_type", ["video", "sample_movie"]).in("fetch_status", ["dead", "forbidden"]),
    supabaseAdmin.from("x_growth_opportunities").select("id", { count: "exact", head: true }).eq("account_handle", X_GROWTH_ACCOUNT).eq("media_type", "sample_movie").is("recommended_media_asset_id", null),
  ]);
  const error = [works.error, synced.error, unknown.error, review.error, allowed.error, blocked.error, dead.error, waiting.error].find(Boolean);
  return {
    error: error?.message ?? null,
    mp4Candidates: works.count ?? 0,
    synced: synced.count ?? 0,
    unknown: unknown.count ?? 0,
    review: review.count ?? 0,
    allowed: allowed.count ?? 0,
    blocked: blocked.count ?? 0,
    dead: dead.count ?? 0,
    topPickRightsWaiting: waiting.count ?? 0,
  };
}

export async function getRightsReviewQueue(limit = 12) {
  const { data, error } = await supabaseAdmin
    .from("x_media_assets")
    .select("*, works(title,image_url,actress,genre,review_average,review_count,discount_rate,ranking)")
    .eq("account_handle", X_GROWTH_ACCOUNT)
    .in("media_type", ["video", "sample_movie"])
    .in("rights_status", ["unknown", "review", "allowed", "unchecked"])
    .not("fetch_status", "in", "(dead,forbidden)")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return { rows: (data ?? []) as Array<XMediaAsset & { works?: Record<string, unknown> | null }>, error: error?.message ?? null };
}
