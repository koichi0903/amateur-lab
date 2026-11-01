import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { getBlueskySampleWorkMedia } from "@/lib/blueskySampleMedia";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const contentId = request.nextUrl.searchParams.get("contentId") ?? "";
  try {
    const work = await getBlueskySampleWorkMedia(contentId);
    if (!work) return NextResponse.json({ error: "作品が登録データに見つかりません。" }, { status: 404 });
    return NextResponse.json(work, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "作品データを取得できませんでした。" }, { status: 400 });
  }
}

