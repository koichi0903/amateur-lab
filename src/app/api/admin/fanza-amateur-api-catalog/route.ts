import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import {
  fetchNextFanzaAmateurApiCatalogPage,
  getActiveFanzaAmateurApiCatalogRun,
  getLatestFanzaAmateurApiCatalogRun,
  startFanzaAmateurApiCatalogRun,
} from "@/lib/dmm/fanzaAmateurApiCatalogScan";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function responseError(error: unknown) {
  return error instanceof Error ? error.message : "素人作品のAPI取得に失敗しました。";
}

function withProgress(run: Awaited<ReturnType<typeof getLatestFanzaAmateurApiCatalogRun>>) {
  return { run, processedItemCount: run?.fetched_item_count ?? 0 };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  try {
    return NextResponse.json(withProgress(await getLatestFanzaAmateurApiCatalogRun()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: responseError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: unknown; runId?: unknown };
  try {
    if (body.action === "start") {
      const run = await startFanzaAmateurApiCatalogRun();
      return NextResponse.json(withProgress(run), { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action === "continue" && typeof body.runId === "string") {
      const run = await getActiveFanzaAmateurApiCatalogRun();
      if (!run || run.id !== body.runId) {
        return NextResponse.json({ error: "実行中の取得ジョブがありません。状況を再読み込みしてください。" }, { status: 409 });
      }
      const nextRun = await fetchNextFanzaAmateurApiCatalogPage(run);
      return NextResponse.json(withProgress(nextRun), { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "actionはstartまたはcontinueを指定してください。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: responseError(error) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
