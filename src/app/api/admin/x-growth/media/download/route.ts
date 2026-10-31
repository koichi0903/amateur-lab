import { NextRequest, NextResponse } from "next/server";
import { auditXGrowth } from "@/lib/xGrowthOperations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canTrimFanzaXGrowthSampleMovie, isFanzaXGrowthTechnicalSampleMovie, sourceDomain, sourceKindFor } from "@/lib/xMediaAssets";
import { readAndCleanupTrimmedVideo, trimVideoForX } from "@/lib/xVideoTrim";
import { xGrowthMediaResponseHeaders } from "@/lib/xGrowthMediaPreview";
import { xGrowthMediaDataCard } from "@/lib/x-growth/xGrowthMediaDataCard";

export const dynamic = "force-dynamic";

const ACCOUNT = "hakkutsu_lab";

type MediaResolution =
  | { error: string; status: 400 | 403 | 404 }
  | { body: string; contentType: string; basename: string; fallbackExt: string }
  | { url: string; basename: string; fallbackExt: string; asset?: Record<string, unknown> };

function extFromContentType(contentType: string, fallback: string) {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return fallback;
}

function safeFilename(value: string) {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "x-growth-media";
}

function isAllowedUpstreamUrl(value: string, mediaType: string) {
  try {
    const url = new URL(value);
    // All remotely fetched X Growth media must remain on the official
    // FANZA/DMM host allowlist. This also excludes localhost/private URLs.
    return url.protocol === "https:" && sourceKindFor(url.toString()) === "official_sample"
      && (mediaType === "sample_movie" || mediaType === "existing_link_image");
  } catch {
    return false;
  }
}

async function fetchAllowedUpstream(url: string, mediaType: string, range?: string | null) {
  let current = url;
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    if (!isAllowedUpstreamUrl(current, mediaType)) throw new Error("許可されていない素材URLです。");
    const response = await fetch(current, {
      cache: "no-store",
      redirect: "manual",
      headers: range && mediaType === "sample_movie" ? { Range: range } : undefined,
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    current = new URL(location, current).toString();
  }
  throw new Error("素材URLのリダイレクト回数が上限を超えました。");
}

async function resolveSampleMovie(workId: number, mediaType: string, assetId: number | null): Promise<MediaResolution> {
  let data: Record<string, unknown> | null = null;
  if (assetId) {
    const result = await supabaseAdmin
      .from("x_media_assets")
      .select("*")
      .eq("account_handle", ACCOUNT)
      .eq("id", assetId)
      .single();
    if (result.error || !result.data) return { error: result.error?.message ?? "動画素材が見つかりません。", status: 404 };
    data = result.data as Record<string, unknown>;
  } else {
    const result = await supabaseAdmin
      .from("works")
      .select("id,product_id,sample_movie_url")
      .eq("id", workId)
      .single();
    const work = result.data as { id: number; product_id: string | null; sample_movie_url: string | null } | null;
    if (result.error || !work?.sample_movie_url) return { error: result.error?.message ?? "動画素材が見つかりません。", status: 404 };
    data = {
      id: undefined,
      work_id: work.id,
      product_id: work.product_id,
      media_type: "sample_movie",
      source_url: work.sample_movie_url,
      source_domain: sourceDomain(work.sample_movie_url),
      source_kind: sourceKindFor(work.sample_movie_url),
      fetch_status: null,
      media_quality: "unreviewed",
      manual_tags: [],
      can_modify: false,
      trim_start_seconds: 0,
      trim_modify_confirmed: false,
    };
  }
  const asset = data as { id?: number; work_id: number | null; source_url: string; media_type: string };
  const allowed = (asset.media_type === "sample_movie" || asset.media_type === "video") && asset.work_id === workId && (
    isFanzaXGrowthTechnicalSampleMovie(data, asset.source_url).usable
  );
  if (!allowed) {
    await auditXGrowth("media_download_blocked", { workId, mediaType, assetId, reasons: isFanzaXGrowthTechnicalSampleMovie(data, asset.source_url).reasons });
    return { error: "このmp4はX投稿用に保存できません。", status: 403 };
  }
  return { url: asset.source_url, basename: `hakkutsu-${workId}-sample`, fallbackExt: "mp4", asset: data };
}

async function resolveDataCard(workId: number): Promise<MediaResolution> {
  const { data, error } = await supabaseAdmin
    .from("works")
    .select("id,title,actress,genre,ranking,discount_rate,review_average,review_count,sale_price,price,list_price,lowest_price,is_bottom_price,is_on_sale,sale_end_at")
    .eq("id", workId)
    .single();
  const work = data as Parameters<typeof xGrowthMediaDataCard>[0] | null;
  if (error || !work) return { error: error?.message ?? "カード素材が見つかりません。", status: 404 };
  return { body: xGrowthMediaDataCard(work), contentType: "image/svg+xml; charset=utf-8", basename: `hakkutsu-${workId}-market-card`, fallbackExt: "svg" };
}

async function resolveExistingLinkImage(workId: number): Promise<MediaResolution> {
  const { data, error } = await supabaseAdmin
    .from("works")
    .select("id,image_url")
    .eq("id", workId)
    .single();
  const work = data as { id: number; image_url: string | null } | null;
  if (error || !work?.image_url) return { error: error?.message ?? "画像素材が見つかりません。", status: 404 };
  return { url: work.image_url, basename: `hakkutsu-${workId}-image`, fallbackExt: "jpg" };
}

async function resolveMedia(workId: number, mediaType: string, assetId: number | null): Promise<MediaResolution> {
  if (mediaType === "sample_movie") return resolveSampleMovie(workId, mediaType, assetId);
  if (mediaType === "data_card") return resolveDataCard(workId);
  if (mediaType === "existing_link_image") return resolveExistingLinkImage(workId);
  return { error: "保存できる素材タイプではありません。", status: 400 };
}

type UrlMediaResolution = Extract<MediaResolution, { url: string }>;
type InlineMediaResolution = Extract<MediaResolution, { body: string }>;

async function respondWithInlineMedia(
  resolved: InlineMediaResolution,
  workId: number,
  mediaType: string,
  assetId: number | null,
  preview: boolean,
) {
  await auditXGrowth("media_download_allowed", { workId, mediaType, assetId, contentType: resolved.contentType });
  return new NextResponse(resolved.body, {
    headers: {
      "Content-Type": resolved.contentType,
      "Content-Disposition": `${mediaType === "data_card" && preview ? "inline" : "attachment"}; filename="${safeFilename(resolved.basename)}.${resolved.fallbackExt}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function respondWithTrimmedMovie(input: {
  resolved: UrlMediaResolution;
  workId: number;
  mediaType: string;
  assetId: number | null;
  preview: boolean;
}): Promise<NextResponse | null> {
  const { resolved, workId, mediaType, assetId, preview } = input;
  const trimStartSeconds = Number((resolved.asset as { trim_start_seconds?: unknown } | undefined)?.trim_start_seconds ?? 0);
  if (mediaType !== "sample_movie" || trimStartSeconds <= 0 || preview) return null;

  const trimVerdict = canTrimFanzaXGrowthSampleMovie(resolved.asset, resolved.url);
  if (!trimVerdict.usable) {
    await auditXGrowth("media_trim_download_blocked", { workId, mediaType, assetId, reasons: trimVerdict.reasons });
    return NextResponse.json({ error: `トリムに失敗しました: ${trimVerdict.reasons.join(" / ")}` }, { status: 403 });
  }

  const trimmed = await trimVideoForX({ sourceUrl: resolved.url, trimStartSeconds });
  const body = await readAndCleanupTrimmedVideo(trimmed);
  await auditXGrowth("media_trim_download_allowed", {
    workId,
    mediaType,
    assetId,
    trimStartSeconds: trimmed.trimStartSeconds,
    sourceDuration: trimmed.durationSeconds,
    outputDuration: trimmed.outputDurationSeconds,
    codec: trimmed.codec,
    audioCodec: trimmed.audioCodec,
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${safeFilename(`${resolved.basename}-trim${trimmed.trimStartSeconds.toFixed(1)}`)}.mp4"`,
      "Cache-Control": "private, no-store",
      "X-Trim-Start-Seconds": trimmed.trimStartSeconds.toFixed(1),
      "X-Video-Duration-Seconds": trimmed.outputDurationSeconds.toFixed(3),
      "X-Video-Codec": trimmed.codec ?? "",
      "X-Audio-Codec": trimmed.audioCodec ?? "",
    },
  });
}

async function respondWithUpstreamMedia(input: {
  resolved: UrlMediaResolution;
  workId: number;
  mediaType: string;
  assetId: number | null;
  preview: boolean;
  range: string | null;
}) {
  const { resolved, workId, mediaType, assetId, preview, range } = input;
  const upstream = await fetchAllowedUpstream(resolved.url, mediaType, range);
  if ((!upstream.ok && upstream.status !== 416) || (!upstream.body && upstream.status !== 416)) {
    await auditXGrowth("media_download_failed", { workId, mediaType, assetId, status: upstream.status });
    return NextResponse.json({ error: "素材を取得できませんでした。" }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const ext = extFromContentType(contentType, resolved.fallbackExt);
  const headers = xGrowthMediaResponseHeaders({
    contentType,
    contentLength: upstream.headers.get("content-length"),
    contentRange: upstream.headers.get("content-range"),
    acceptRanges: mediaType === "sample_movie" ? (upstream.headers.get("accept-ranges") ?? "bytes") : upstream.headers.get("accept-ranges"),
    preview,
    filename: `${safeFilename(resolved.basename)}.${ext}`,
  });
  if (upstream.status === 416) {
    await auditXGrowth("media_download_failed", { workId, mediaType, assetId, status: upstream.status });
    return new NextResponse(null, { status: 416, headers });
  }
  await auditXGrowth("media_download_allowed", { workId, mediaType, assetId, contentType });
  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}

async function respondWithRemoteMedia(input: {
  resolved: UrlMediaResolution;
  workId: number;
  mediaType: string;
  assetId: number | null;
  preview: boolean;
  range: string | null;
}) {
  const { resolved, workId, mediaType, assetId, preview, range } = input;
  try {
    const trimmedResponse = await respondWithTrimmedMovie({ resolved, workId, mediaType, assetId, preview });
    if (trimmedResponse) return trimmedResponse;
    return await respondWithUpstreamMedia({ resolved, workId, mediaType, assetId, preview, range });
  } catch (error) {
    await auditXGrowth("media_download_failed", { workId, mediaType, assetId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "素材保存に失敗しました。" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const workId = Number(request.nextUrl.searchParams.get("workId"));
  const assetIdParam = request.nextUrl.searchParams.get("assetId");
  const assetId = assetIdParam ? Number(assetIdParam) : null;
  const mediaType = request.nextUrl.searchParams.get("mediaType") ?? "";
  const preview = request.nextUrl.searchParams.get("preview") === "1";
  const range = request.headers.get("range");
  if (!Number.isSafeInteger(workId) || workId <= 0) {
    return NextResponse.json({ error: "workIdが不正です。" }, { status: 400 });
  }

  const validAssetId = assetId && Number.isSafeInteger(assetId) ? assetId : null;
  const resolved = await resolveMedia(workId, mediaType, validAssetId);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  if ("body" in resolved) return respondWithInlineMedia(resolved, workId, mediaType, assetId, preview);

  return respondWithRemoteMedia({ resolved, workId, mediaType, assetId, preview, range });
}
