import { createBlueskyTrimmedSample, streamAndCleanupBlueskyTrim } from "@/lib/blueskySampleMedia";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const contentId = request.nextUrl.searchParams.get("contentId") ?? "";
  const start = Number(request.nextUrl.searchParams.get("startSeconds"));
  const end = Number(request.nextUrl.searchParams.get("endSeconds"));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > 600) {
    return NextResponse.json({ error: "切り抜き位置を確認してください（0〜600秒）。" }, { status: 400 });
  }
  try {
    const trimmed = await createBlueskyTrimmedSample(contentId, start, end);
    const stream = await streamAndCleanupBlueskyTrim(trimmed);
    return new NextResponse(stream.body, { headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${stream.filename}"`,
      "Content-Length": String(stream.size),
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "切り抜き動画を準備できませんでした。" }, { status: 400 });
  }
}

