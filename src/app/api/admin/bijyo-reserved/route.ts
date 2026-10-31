import { NextRequest, NextResponse } from "next/server";
import { createBijyoManualJob, excludeBijyoJob, getBijyoDashboard, getBijyoManualJobsPage, markBijyoPosted, prepareBijyoVideo, skipBijyoFutureWork, skipBijyoJob } from "@/lib/bijyoReservedAutoPost";
import { getBijyoHistoryPage, getBijyoReservedQueueWorks } from "@/lib/bijyoReadPages";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { executeBijyoManualAction } from "@/lib/bijyoManualAction";

export const dynamic = "force-dynamic";

function userSafeResult<T extends { error?: string }>(result: T) {
  if (!result.error || /[\u3040-\u30ff\u3400-\u9fff]/.test(result.error)) return result;
  return { ...result, error: "処理に失敗しました。画面を更新してから再試行してください。" };
}

function manualOperationErrorResponse(error: unknown) {
  if (error instanceof Error && /^(workId|jobId)が不正です。$/.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ ok: false, error: message }, { status: message.includes("すでに実行中") ? 409 : 500 });
}

async function handleManualAction(workId: number, jobId: number) {
  try {
    const actionResult = await executeBijyoManualAction("manual", { workId, jobId }, {
      createManualJob: createBijyoManualJob,
      prepareVideo: prepareBijyoVideo,
    });
    if (actionResult === null) return NextResponse.json({ error: "この画面ではX API自動投稿を利用しません。" }, { status: 400 });
    return NextResponse.json(userSafeResult(actionResult));
  } catch (error) {
    return manualOperationErrorResponse(error);
  }
}

async function handlePrepareVideoAction(workId: number, jobId: number) {
  try {
    const prepared = await executeBijyoManualAction("prepareVideo", { workId, jobId }, {
      createManualJob: createBijyoManualJob,
      prepareVideo: prepareBijyoVideo,
    });
    if (!prepared) return NextResponse.json({ error: "動画準備の対象ジョブが見つかりません。" }, { status: 404 });
    return new NextResponse(new Uint8Array(prepared.bytes), { headers: { "Content-Type": "video/mp4", "Content-Disposition": `inline; filename="${prepared.filename}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return manualOperationErrorResponse(error);
  }
}

async function handleManualTrimAction(body: Record<string, unknown>, jobId: number, workId: number) {
  if (!Number.isSafeInteger(jobId) || jobId <= 0) return NextResponse.json({ error: "jobIdが不正です。" }, { status: 400 });
  if (workId !== 0 && (!Number.isSafeInteger(workId) || workId <= 0)) return NextResponse.json({ error: "workIdが不正です。" }, { status: 400 });
  const mode = body.mode === "resetAuto" ? "auto" : "manual";
  try {
    const trim = await prepareBijyoVideo(jobId, workId > 0 ? workId : undefined, { mode, trimStartSeconds: body.trimStartSeconds });
    return NextResponse.json({ ok: true, jobId, trim: { ok: true, trimStartSeconds: Number(trim.filename.match(/trim-(\d+(?:\.\d+)?)s/)?.[1] ?? 0) } });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && Number((error as { status?: unknown }).status) === 400 ? 400 : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status });
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const historyValue = request.nextUrl.searchParams.get("historyPage");
  const reservedValue = request.nextUrl.searchParams.get("reservedPage");
  if (historyValue !== null && reservedValue === null) {
    const page = Math.max(1, Number(historyValue) || 1);
    const result = await getBijyoHistoryPage(page);
    return NextResponse.json({ ...result, historyPage: result.page, historyHasMore: result.hasMore }, { headers: { "Cache-Control": "no-store" } });
  }
  if (reservedValue !== null && historyValue === null) {
    const page = Math.max(1, Number(reservedValue) || 1);
    const result = await getBijyoReservedQueueWorks(page);
    return NextResponse.json({ reservedWorks: result.works, reservedHasMore: result.hasMore, error: result.error }, { headers: { "Cache-Control": "no-store" } });
  }
  if (request.nextUrl.searchParams.has("manualPage")) {
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("manualPage")) || 1);
    return NextResponse.json(await getBijyoManualJobsPage(page), { headers: { "Cache-Control": "no-store" } });
  }
  const historyPage = Math.max(1, Number(request.nextUrl.searchParams.get("historyPage") ?? "1") || 1);
  const reservedPageValue = Math.max(1, Number(request.nextUrl.searchParams.get("reservedPage") ?? "1") || 1);
  return NextResponse.json(await getBijyoDashboard(historyPage, reservedPageValue));
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const jobId = Number(body.jobId);
  const workId = Number(body.workId);
  let result: { ok: boolean; error?: string; code?: string; state?: string; jobId?: number; existing?: boolean };
  if (!Number.isSafeInteger(jobId) && ["posted", "exclude"].includes(action)) return NextResponse.json({ error: "jobIdが不正です。" }, { status: 400 });
  if (action === "posted") {
    const xPostUrl = typeof body.xPostUrl === "string" ? body.xPostUrl.trim() : "";
    const match = xPostUrl.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)(?:[/?#].*)?$/i);
    if (!match) return NextResponse.json({ error: "X投稿URLを入力してください（例: https://x.com/アカウント/status/投稿ID）。" }, { status: 400 });
    result = await markBijyoPosted(jobId, match[1]);
  }
  else if (action === "skip") result = Number.isSafeInteger(jobId) && jobId > 0 ? await skipBijyoJob(jobId) : Number.isSafeInteger(workId) && workId > 0 ? await skipBijyoFutureWork(workId) : { ok: false, error: "jobIdまたはworkIdが不正です。" };
  else if (action === "exclude") result = await excludeBijyoJob(jobId);
  else if (action === "manual") return handleManualAction(workId, jobId);
  else if (action === "prepareVideo") return handlePrepareVideoAction(workId, jobId);
  else if (action === "manualTrim") return handleManualTrimAction(body, jobId, workId);
  else return NextResponse.json({ error: "この画面ではX API自動投稿を利用しません。" }, { status: 400 });
  const safeResult = userSafeResult(result);
  return NextResponse.json(safeResult, { status: safeResult.ok ? 200 : 409 });
}
