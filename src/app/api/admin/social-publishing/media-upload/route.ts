import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertPrivateSocialPublishingBucket, socialPublishingMediaMaxBytes } from "@/lib/socialPublishingMedia";
import { isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
import { readAndCleanupTrimmedVideo, trimVideoForX } from "@/lib/xVideoTrim";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "同一オリジンからの要求が必要です。" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as { mode?: unknown; mimeType?: unknown; size?: unknown; sourceWorkId?: unknown; trimStartSeconds?: unknown; trimEndSeconds?: unknown } | null;
  const maxBytes = socialPublishingMediaMaxBytes();
  if (payload?.mode === "sample-clip") {
    const workId = typeof payload.sourceWorkId === "number" && Number.isSafeInteger(payload.sourceWorkId) ? payload.sourceWorkId : null;
    const start = typeof payload.trimStartSeconds === "number" ? payload.trimStartSeconds : null;
    const end = typeof payload.trimEndSeconds === "number" ? payload.trimEndSeconds : null;
    const normalizedStart = start === null ? null : Math.round(start * 10) / 10;
    const normalizedEnd = end === null ? null : Math.round(end * 10) / 10;
    if (workId === null || normalizedStart === null || normalizedEnd === null || normalizedStart < 0 || normalizedEnd <= normalizedStart || normalizedEnd - normalizedStart > 60) {
      return NextResponse.json({ error: "公式サンプルの切り抜き区間は0〜60秒で指定してください。" }, { status: 400 });
    }
    const { data: work, error: workError } = await supabaseAdmin
      .from("works")
      .select("id, sample_movie_url")
      .eq("id", workId)
      .maybeSingle();
    if (workError) return NextResponse.json({ error: "作品サンプル情報を取得できませんでした。" }, { status: 503 });
    if (!work || !isOfficialFanzaDmmSampleUrl(work.sample_movie_url)) {
      return NextResponse.json({ error: "HTTPSの公式サンプル動画が見つかりません。" }, { status: 400 });
    }
    let trimmed: Awaited<ReturnType<typeof trimVideoForX>>;
    try {
      trimmed = await trimVideoForX({ sourceUrl: work.sample_movie_url, trimStartSeconds: normalizedStart, trimEndSeconds: normalizedEnd }, {
        maxBytes, timeoutMs: 25_000, rejectRedirects: true,
      });
      const bytes = await readAndCleanupTrimmedVideo(trimmed);
      if (bytes.length > maxBytes) return NextResponse.json({ error: "切り抜き後の動画が容量上限を超えています。" }, { status: 413 });
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": "attachment; filename=sample-clip.mp4",
          "Cache-Control": "no-store",
          "X-Source-Work-Id": String(workId),
          "X-Trim-Range": `${normalizedStart}-${normalizedEnd}`,
        },
      });
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error ? cause.message : "公式サンプルを切り抜けませんでした。" }, { status: 422 });
    }
  }
  if (payload?.mimeType !== "video/mp4" || typeof payload.size !== "number" || !Number.isSafeInteger(payload.size) || payload.size < 1 || payload.size > maxBytes) {
    return NextResponse.json({ error: "MP4動画のみ対応します。容量上限は" + Math.floor(maxBytes / 1024 / 1024) + "MBです。" }, { status: 400 });
  }

  let bucket: string;
  try {
    bucket = await assertPrivateSocialPublishingBucket();
  } catch {
    return NextResponse.json({ error: "非公開メディア保存先が未設定、または非公開であることを確認できません。" }, { status: 503 });
  }

  const storageKey = "incoming/" + randomUUID() + ".mp4";
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(storageKey, { upsert: false });
  if (error || !data?.token) {
    return NextResponse.json({ error: "安全なアップロードURLを発行できませんでした。" }, { status: 503 });
  }
  return NextResponse.json({ storageKey, token: data.token, bucket }, {
    status: 201,
    headers: { "Cache-Control": "no-store", "Pragma": "no-cache" },
  });
}
