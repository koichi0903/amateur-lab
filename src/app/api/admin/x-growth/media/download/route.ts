import { NextRequest, NextResponse } from "next/server";
import { auditXGrowth } from "@/lib/xGrowthOperations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canTrimXMediaAsset, isUsableXMediaAsset } from "@/lib/xMediaAssets";
import { readAndCleanupTrimmedVideo, trimVideoForX } from "@/lib/xVideoTrim";

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
}) {
  const genre = work.genre?.split(/[,、/]/)[0]?.trim() || "今日の注目枠";
  const price = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
  const axis = work.discount_rate && work.discount_rate >= 30
    ? `${Math.round(work.discount_rate)}%OFF`
    : work.ranking ? `ランキング${work.ranking}位`
      : work.review_average ? `評価${work.review_average.toFixed(1)}`
        : "サンプル優先";
  const comparison = [
    work.review_average ? `評価 ${work.review_average.toFixed(1)}` : "",
    work.ranking ? `順位 ${work.ranking}` : "",
    price ? `価格 ${price.toLocaleString("ja-JP")}円` : "",
  ].filter(Boolean).slice(0, 3);
  const titleLines = splitText(work.title, 22, 3);
  const actress = work.actress?.split(/[,、/]/)[0]?.trim() || "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#09090b"/>
  <rect x="54" y="54" width="1092" height="567" rx="18" fill="#101316" stroke="#2dd4bf" stroke-width="3"/>
  <text x="92" y="118" fill="#67e8f9" font-size="30" font-weight="800" font-family="Arial, sans-serif">今日のセール欄で見る場所</text>
  <text x="92" y="190" fill="#ffffff" font-size="60" font-weight="900" font-family="Arial, sans-serif">${escapeXml(genre)}から見る日</text>
  <rect x="92" y="236" width="430" height="96" rx="12" fill="#042f2e" stroke="#14b8a6" stroke-width="2"/>
  <text x="120" y="299" fill="#ccfbf1" font-size="48" font-weight="900" font-family="Arial, sans-serif">${escapeXml(axis)}</text>
  <text x="92" y="388" fill="#d4d4d8" font-size="34" font-weight="700" font-family="Arial, sans-serif">${escapeXml(actress)}</text>
  ${titleLines.map((line, index) => `<text x="92" y="${438 + index * 42}" fill="#fafafa" font-size="34" font-weight="800" font-family="Arial, sans-serif">${escapeXml(line)}</text>`).join("")}
  ${comparison.map((line, index) => `<g><rect x="${690}" y="${246 + index * 82}" width="350" height="58" rx="12" fill="#18181b" stroke="#3f3f46"/><text x="716" y="${285 + index * 82}" fill="#f4f4f5" font-size="28" font-weight="800" font-family="Arial, sans-serif">${escapeXml(line)}</text></g>`).join("")}
  <text x="92" y="580" fill="#a1a1aa" font-size="26" font-weight="700" font-family="Arial, sans-serif">@hakkutsu_lab</text>
</svg>`;
}

async function resolveMedia(workId: number, mediaType: string, assetId: number | null) {
  if (mediaType === "sample_movie") {
    if (!assetId) return { error: "動画保存にはmedia assetが必要です。", status: 400 as const };
    const { data, error } = await supabaseAdmin
      .from("x_media_assets")
      .select("*")
      .eq("account_handle", ACCOUNT)
      .eq("id", assetId)
      .single();
    const asset = data as { id: number; work_id: number | null; source_url: string; media_type: string } | null;
    if (error || !asset) return { error: error?.message ?? "動画素材が見つかりません。", status: 404 as const };
    const allowed = (asset.media_type === "sample_movie" || asset.media_type === "video") && asset.work_id === workId && isUsableXMediaAsset(data).usable;
    if (!allowed) {
      await auditXGrowth("media_download_blocked", { workId, mediaType, assetId, reasons: isUsableXMediaAsset(data).reasons });
      return { error: "このmp4はX投稿用に保存できません。", status: 403 as const };
    }
    return { url: asset.source_url, basename: `hakkutsu-${workId}-sample`, fallbackExt: "mp4", asset: data as Record<string, unknown> };
  }

  if (mediaType === "data_card") {
    const { data, error } = await supabaseAdmin
      .from("works")
      .select("id,title,actress,genre,ranking,discount_rate,review_average,review_count,sale_price,price")
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
        "Content-Disposition": `attachment; filename="${safeFilename(resolved.basename)}.${resolved.fallbackExt}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  try {
    const trimStartSeconds = "asset" in resolved ? Number((resolved.asset as { trim_start_seconds?: unknown }).trim_start_seconds ?? 0) : 0;
    if (mediaType === "sample_movie" && trimStartSeconds > 0) {
      const trimVerdict = canTrimXMediaAsset(resolved.asset);
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

    const upstream = await fetch(resolved.url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      await auditXGrowth("media_download_failed", { workId, mediaType, assetId, status: upstream.status });
      return NextResponse.json({ error: "素材を取得できませんでした。" }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const ext = extFromContentType(contentType, resolved.fallbackExt);
    await auditXGrowth("media_download_allowed", { workId, mediaType, assetId, contentType });
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename(resolved.basename)}.${ext}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    await auditXGrowth("media_download_failed", { workId, mediaType, assetId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "素材保存に失敗しました。" }, { status: 500 });
  }
}
