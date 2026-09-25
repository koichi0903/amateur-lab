import { NextResponse } from "next/server";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { ensureMyfansDailySnapshot } from "@/lib/myfansDailySnapshot";
import { buildMyfansExecutionBoard } from "@/lib/myfansXExecution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { approvedMediaId?: number; planDate?: string };
    const approvedMediaId = Number.isFinite(body.approvedMediaId) ? Number(body.approvedMediaId) : 1;
    const analytics = await getMyfansAnalytics({ approvedMediaId });
    if (analytics.error) return NextResponse.json({ error: "候補データを読み込めません。接続状態を確認して再試行してください。" }, { status: 503 });
    const board = buildMyfansExecutionBoard(analytics, body.planDate ? { planDate: body.planDate } : {});
    const snapshot = await ensureMyfansDailySnapshot(board, approvedMediaId);
    if (snapshot.status === "unavailable") {
      return NextResponse.json({ error: snapshot.message, code: snapshot.errorCode ?? "RPC_EMPTY_RESULT" }, { status: 503 });
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("myfans daily plan reevaluate failed", error);
    return NextResponse.json({ error: "Daily Planの再評価に失敗しました。保存状態は変更されていません。時間をおいて再試行してください。" }, { status: 500 });
  }
}
