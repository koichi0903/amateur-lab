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
    if (analytics.error) return NextResponse.json({ error: analytics.error }, { status: 503 });
    const board = buildMyfansExecutionBoard(analytics, body.planDate ? { planDate: body.planDate } : {});
    const snapshot = await ensureMyfansDailySnapshot(board, approvedMediaId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "再評価に失敗しました。" }, { status: 500 });
  }
}
