import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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
    if (request.nextUrl.searchParams.get("items") === "1") {
      const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
      const pageSize = 20;
      const from = (page - 1) * pageSize;
      const { data, count, error } = await supabaseAdmin
        .from("fanza_amateur_works")
        .select("content_id,title,api_date,rank,raw_item,fetched_at", { count: "exact" })
        .order("api_date", { ascending: false, nullsFirst: false })
        .order("content_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`素人作品テーブルを読めませんでした: ${error.message}`);
      return NextResponse.json({ items: data ?? [], page, pageSize, total: count ?? 0 }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
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
