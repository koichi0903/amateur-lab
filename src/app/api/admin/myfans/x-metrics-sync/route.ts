import { NextResponse } from "next/server";
import { syncMyfansXPostMetrics } from "@/lib/myfansXMetricsSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncMyfansXPostMetrics();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("myfans X metrics sync failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "X投稿成績の同期に失敗しました。" },
      { status: 500 },
    );
  }
}
