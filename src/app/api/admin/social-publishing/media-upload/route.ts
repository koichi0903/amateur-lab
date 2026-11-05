import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertPrivateSocialPublishingBucket, socialPublishingMediaMaxBytes } from "@/lib/socialPublishingMedia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "同一オリジンからの要求が必要です。" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null) as { mode?: unknown; mimeType?: unknown; size?: unknown } | null;
  const maxBytes = socialPublishingMediaMaxBytes();
  if (payload?.mode === "sample-clip") {
    return NextResponse.json({ error: "TikTok向け素材準備は廃止されました。" }, { status: 410 });
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
