import { NextRequest, NextResponse } from "next/server";
import { auditXGrowth } from "@/lib/xGrowthOperations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canTrimFanzaXGrowthSampleMovie, isFanzaXGrowthTechnicalSampleMovie, sourceDomain, sourceKindFor } from "@/lib/xMediaAssets";
import { readAndCleanupTrimmedVideo, trimVideoForX } from "@/lib/xVideoTrim";
import { xGrowthMediaResponseHeaders } from "@/lib/xGrowthMediaPreview";
import { parseDatabaseDate } from "@/lib/dateTime";

export const dynamic = "force-dynamic";

const ACCOUNT = "hakkutsu_lab";

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

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function splitText(value: string, limit: number, maxLines: number) {
  const chars = [...value.replace(/\s+/g, " ").trim()];
  const lines: string[] = [];
  let line = "";
  for (const char of chars) {
    line += char;
    if (line.length >= limit) {
      lines.push(line);
      line = "";
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function dataCardSvg(work: {
  title: string;
  actress: string | null;
  genre: string | null;
  ranking: number | null;
  discount_rate: number | null;
  review_average: number | null;
  review_count: number | null;
  sale_price: number | null;
  price: number | null;
  list_price: number | null;
  lowest_price: number | null;
  is_bottom_price: boolean | null;
  is_on_sale: boolean | null;
  sale_end_at: string | null;
}) {
  const now = Date.now();
  const saleEndAt = parseDatabaseDate(work.sale_end_at)?.getTime() ?? null;
  const saleIsCurrent = Boolean(work.is_on_sale && work.sale_price && work.sale_price > 0 && (!work.sale_end_at || (saleEndAt != null && saleEndAt > now)));
  const currentPrice = saleIsCurrent ? work.sale_price : work.price;
  const regularPrice = work.list_price && currentPrice && work.list_price > currentPrice ? work.list_price : null;
  const discountRate = regularPrice && currentPrice ? Math.round((1 - currentPrice / regularPrice) * 100) : null;
  const recordedLow = work.lowest_price && work.lowest_price > 0 ? work.lowest_price : null;
  const isRecordedLow = Boolean(work.is_bottom_price && recordedLow && currentPrice === recordedLow);
  const saleEnd = work.sale_end_at && saleEndAt && saleEndAt > now
    ? new Date(saleEndAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" })
    : null;
  const titleLines = splitText(work.title, 22, 3);
  const actress = work.actress?.split(/[,、/]/)[0]?.trim() || "";
  const priceText = (value: number | null) => value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "未取得";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#09090b"/>
  <rect x="42" y="42" width="1116" height="591" rx="24" fill="#101316" stroke="#ec4899" stroke-width="3"/>
  <text x="82" y="106" fill="#f9a8d4" font-size="28" font-weight="800" font-family="Arial, sans-serif">発掘LAB｜価格をチェック</text>
  ${isRecordedLow ? `<rect x="865" y="70" width="235" height="54" rx="27" fill="#831843"/><text x="982" y="106" text-anchor="middle" fill="#fff1f2" font-size="24" font-weight="900" font-family="Arial, sans-serif">記録最安と同額</text>` : ""}
  ${actress ? `<text x="82" y="154" fill="#a1a1aa" font-size="24" font-weight="700" font-family="Arial, sans-serif">${escapeXml(actress)}</text>` : ""}
  ${titleLines.map((line, index) => `<text x="82" y="${202 + index * 40}" fill="#ffffff" font-size="32" font-weight="900" font-family="Arial, sans-serif">${escapeXml(line)}</text>`).join("")}
  <g><rect x="82" y="354" width="318" height="142" rx="18" fill="#18181b" stroke="#3f3f46"/><text x="112" y="397" fill="#a1a1aa" font-size="23" font-weight="700" font-family="Arial, sans-serif">通常価格</text><text x="112" y="463" fill="#f4f4f5" font-size="46" font-weight="900" font-family="Arial, sans-serif">${escapeXml(priceText(regularPrice))}</text></g>
  <g><rect x="440" y="354" width="318" height="142" rx="18" fill="#3b102b" stroke="#ec4899" stroke-width="2"/><text x="470" y="397" fill="#fbcfe8" font-size="23" font-weight="700" font-family="Arial, sans-serif">${saleIsCurrent ? "現在価格" : "掲載価格"}</text><text x="470" y="463" fill="#ffffff" font-size="50" font-weight="900" font-family="Arial, sans-serif">${escapeXml(priceText(currentPrice))}</text></g>
  <g><rect x="798" y="354" width="318" height="142" rx="18" fill="#18181b" stroke="#3f3f46"/><text x="828" y="397" fill="#a1a1aa" font-size="23" font-weight="700" font-family="Arial, sans-serif">発掘LABの記録最安</text><text x="828" y="463" fill="#f4f4f5" font-size="46" font-weight="900" font-family="Arial, sans-serif">${escapeXml(priceText(recordedLow))}</text></g>
  <text x="82" y="550" fill="#f9a8d4" font-size="28" font-weight="800" font-family="Arial, sans-serif">${discountRate ? `通常価格から${discountRate}%OFF` : work.review_average ? `レビュー評価 ${work.review_average.toFixed(1)}（${work.review_count ?? 0}件）` : "価格・記録を作品ページで確認"}</text>
  <text x="82" y="594" fill="#a1a1aa" font-size="21" font-weight="700" font-family="Arial, sans-serif">${saleEnd ? `セール期限 ${saleEnd}（サイト掲載情報）` : isRecordedLow ? "価格は発掘LABで記録した範囲の比較です" : "価格・セール状況は遷移先でご確認ください"}</text>
  <text x="1110" y="594" text-anchor="end" fill="#71717a" font-size="20" font-weight="700" font-family="Arial, sans-serif">@hakkutsu_lab</text>
</svg>`;
}

async function resolveMedia(workId: number, mediaType: string, assetId: number | null) {
  if (mediaType === "sample_movie") {
    let data: Record<string, unknown> | null = null;
    if (assetId) {
      const result = await supabaseAdmin
        .from("x_media_assets")
        .select("*")
        .eq("account_handle", ACCOUNT)
        .eq("id", assetId)
        .single();
      if (result.error || !result.data) return { error: result.error?.message ?? "動画素材が見つかりません。", status: 404 as const };
      data = result.data as Record<string, unknown>;
    } else {
      const result = await supabaseAdmin
        .from("works")
        .select("id,product_id,sample_movie_url")
        .eq("id", workId)
        .single();
      const work = result.data as { id: number; product_id: string | null; sample_movie_url: string | null } | null;
      if (result.error || !work?.sample_movie_url) return { error: result.error?.message ?? "動画素材が見つかりません。", status: 404 as const };
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
      return { error: "このmp4はX投稿用に保存できません。", status: 403 as const };
    }
    return { url: asset.source_url, basename: `hakkutsu-${workId}-sample`, fallbackExt: "mp4", asset: data as Record<string, unknown> };
  }

  if (mediaType === "data_card") {
    const { data, error } = await supabaseAdmin
      .from("works")
      .select("id,title,actress,genre,ranking,discount_rate,review_average,review_count,sale_price,price,list_price,lowest_price,is_bottom_price,is_on_sale,sale_end_at")
      .eq("id", workId)
      .single();
    const work = data as Parameters<typeof dataCardSvg>[0] | null;
    if (error || !work) return { error: error?.message ?? "カード素材が見つかりません。", status: 404 as const };
    return { body: dataCardSvg(work), contentType: "image/svg+xml; charset=utf-8", basename: `hakkutsu-${workId}-market-card`, fallbackExt: "svg" };
  }

  if (mediaType === "existing_link_image") {
    const { data, error } = await supabaseAdmin
      .from("works")
      .select("id,image_url")
      .eq("id", workId)
      .single();
    const work = data as { id: number; image_url: string | null } | null;
    if (error || !work?.image_url) return { error: error?.message ?? "画像素材が見つかりません。", status: 404 as const };
    return { url: work.image_url, basename: `hakkutsu-${workId}-image`, fallbackExt: "jpg" };
  }

  return { error: "保存できる素材タイプではありません。", status: 400 as const };
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

  const resolved = await resolveMedia(workId, mediaType, assetId && Number.isSafeInteger(assetId) ? assetId : null);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  if ("body" in resolved) {
    const contentType = resolved.contentType ?? "image/svg+xml; charset=utf-8";
    await auditXGrowth("media_download_allowed", { workId, mediaType, assetId, contentType });
    return new NextResponse(resolved.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${mediaType === "data_card" && preview ? "inline" : "attachment"}; filename="${safeFilename(resolved.basename)}.${resolved.fallbackExt}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  try {
    const trimStartSeconds = "asset" in resolved ? Number((resolved.asset as { trim_start_seconds?: unknown }).trim_start_seconds ?? 0) : 0;
    if (mediaType === "sample_movie" && trimStartSeconds > 0 && !preview) {
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
  } catch (error) {
    await auditXGrowth("media_download_failed", { workId, mediaType, assetId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "素材保存に失敗しました。" }, { status: 500 });
  }
}
