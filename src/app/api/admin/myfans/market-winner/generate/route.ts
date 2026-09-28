import { NextRequest, NextResponse } from "next/server";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { buildMarketWinnerOpportunities } from "@/lib/myfansMarketWinnerServer";
import { getMyfansStrategy } from "@/lib/myfansStrategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { approvedMediaId?: unknown };
    const approvedMediaId = Number(body.approvedMediaId);
    if (!Number.isSafeInteger(approvedMediaId) || approvedMediaId <= 0 || getMyfansStrategy(approvedMediaId).strategyType !== "MARKET_WINNER") {
      return NextResponse.json({ error: "Winner候補生成はMARKET_WINNERアカウントだけで実行できます。" }, { status: 400 });
    }
    const analytics = await getMyfansAnalytics({ approvedMediaId });
    if (analytics.error) return NextResponse.json({ error: "共有供給を読み込めません。生成・保存は実行していません。" }, { status: 503 });
    const result = await buildMarketWinnerOpportunities(analytics, approvedMediaId);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("myfans market winner generation failed", error);
    return NextResponse.json({ error: "Winner候補の生成・更新に失敗しました。既存候補は変更されていない可能性があります。" }, { status: 500 });
  }
}
