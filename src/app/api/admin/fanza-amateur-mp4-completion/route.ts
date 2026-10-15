import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import {
  continueFanzaAmateurMp4Run,
  getActiveFanzaAmateurMp4Run,
  getLatestFanzaAmateurMp4Run,
  startFanzaAmateurMp4Run,
  type FanzaAmateurMp4RunType,
} from "@/lib/dmm/fanzaAmateurMp4Completion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "素人作品のMP4補完に失敗しました。";
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  try {
    const [daily, weekly, activeRun] = await Promise.all([
      getLatestFanzaAmateurMp4Run("daily_incremental"),
      getLatestFanzaAmateurMp4Run("weekly_full"),
      getActiveFanzaAmateurMp4Run(),
    ]);
    return NextResponse.json({ runs: { daily_incremental: daily, weekly_full: weekly }, activeRun }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({})) as { action?: unknown; runType?: unknown; runId?: unknown };
  try {
    if (body.action === "start" && (body.runType === "daily_incremental" || body.runType === "weekly_full")) {
      const run = await startFanzaAmateurMp4Run(body.runType as FanzaAmateurMp4RunType);
      return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "continue" && typeof body.runId === "string") {
      const run = await continueFanzaAmateurMp4Run(body.runId);
      return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "日次/週次のrunTypeまたは実行中runIdが必要です。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
