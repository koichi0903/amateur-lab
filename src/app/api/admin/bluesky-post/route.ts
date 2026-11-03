import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { getBlueskySampleWorkMedia, registerBlueskySampleWork } from "@/lib/blueskySampleMedia";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { contentId?: unknown };
  if (typeof body.contentId !== "string") return NextResponse.json({ error: "FANZA品番を入力してください。" }, { status: 400 });
  try {
    const registered = await registerBlueskySampleWork(body.contentId);
    if (!registered) return NextResponse.json({ error: "公式「素人」APIで品番に一致する作品が見つかりませんでした。" }, { status: 404 });
    return NextResponse.json({
      ...registered,
      message: registered.sampleMovieReady
        ? "公式APIで作品を確認し、この素材画面に登録しました。"
        : "作品情報を登録しましたが、公式サンプル動画は取得できませんでした。もう一度試すか、動画なしとして確認してください。",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "公式作品を登録できませんでした。" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  try {
    const contentId = request.nextUrl.searchParams.get("contentId") ?? "";
    const work = await getBlueskySampleWorkMedia(contentId);
    if (!work) return NextResponse.json({ error: "作品が登録データに見つかりません。" }, { status: 404 });
    return NextResponse.json(work, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "作品データを取得できませんでした。" }, { status: 400 });
  }
}
