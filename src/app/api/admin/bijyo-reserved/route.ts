import { NextRequest, NextResponse } from "next/server";
import { createBijyoManualJob, excludeBijyoJob, getBijyoDashboard, getBijyoManualJobsPage, markBijyoPosted, prepareBijyoVideo, skipBijyoFutureWork, skipBijyoJob } from "@/lib/bijyoReservedAutoPost";
import { getBijyoHistoryPage, getBijyoReservedQueueWorks } from "@/lib/bijyoReadPages";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { executeBijyoManualAction } from "@/lib/bijyoManualAction";
import { resolveBijyoReadPageRequest } from "@/lib/bijyoReadPageRequest";
import { bijyoManualTrimErrorStatus, bijyoTrimSecondsFromFilename, parseBijyoManualTrimRequest } from "@/lib/bijyoManualTrimRequest";

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
  const parsed = parseBijyoManualTrimRequest(body, jobId, workId);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const trim = await prepareBijyoVideo(parsed.value.jobId, parsed.value.workId, { mode: parsed.value.mode, trimStartSeconds: parsed.value.trimStartSeconds });
    return NextResponse.json({ ok: true, jobId, trim: { ok: true, trimStartSeconds: bijyoTrimSecondsFromFilename(trim.filename) } });
  } catch (error) {
    const status = bijyoManualTrimErrorStatus(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status });
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const pageRequest = resolveBijyoReadPageRequest({
    historyPage: request.nextUrl.searchParams.get("historyPage"),
    reservedPage: request.nextUrl.searchParams.get("reservedPage"),
    manualPage: request.nextUrl.searchParams.has("manualPage") ? request.nextUrl.searchParams.get("manualPage") : null,
  });
  if (pageRequest.mode === "history") {
    const result = await getBijyoHistoryPage(pageRequest.page);
    return NextResponse.json({ ...result, historyPage: result.page, historyHasMore: result.hasMore }, { headers: { "Cache-Control": "no-store" } });
  }
  if (pageRequest.mode === "reserved") {
    const result = await getBijyoReservedQueueWorks(pageRequest.page);
    return NextResponse.json({ reservedWorks: result.works, reservedHasMore: result.hasMore, error: result.error }, { headers: { "Cache-Control": "no-store" } });
  }
  if (pageRequest.mode === "manual") {
    return NextResponse.json(await getBijyoManualJobsPage(pageRequest.page), { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(await getBijyoDashboard(pageRequest.historyPage, pageRequest.reservedPage));
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
