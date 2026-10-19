import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { createAmateurXJob, getAmateurXDashboard, normalizeXHandle, updateAmateurXJobStatus, updateAmateurXJobText } from "@/lib/fanzaAmateurXManualPost";

export const dynamic = "force-dynamic";

function validLane(value: unknown): value is "new_release" | "popular" {
  return value === "new_release" || value === "popular";
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const handle = normalizeXHandle(request.nextUrl.searchParams.get("account"));
  const lane = request.nextUrl.searchParams.get("lane");
  const page = Math.max(1, Math.trunc(Number(request.nextUrl.searchParams.get("page") ?? 1) || 1));
  if (!handle) return NextResponse.json({ error: "Xアカウント名を入力してください。" }, { status: 400 });
  if (!validLane(lane)) return NextResponse.json({ error: "候補の種類が不正です。" }, { status: 400 });
  try { return NextResponse.json(await getAmateurXDashboard(handle, lane, page)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "候補を取得できませんでした。" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const handle = normalizeXHandle(body.account);
  if (!handle) return NextResponse.json({ error: "Xアカウント名が不正です。" }, { status: 400 });
  const action = String(body.action ?? "");
  const jobId = Number(body.jobId);
  try {
    if (action === "add") {
      const contentId = String(body.contentId ?? "").trim();
      if (!contentId || contentId.length > 120 || !validLane(body.lane)) return NextResponse.json({ error: "作品または候補の種類が不正です。" }, { status: 400 });
      const result = await createAmateurXJob(handle, contentId, body.lane);
      return NextResponse.json(result, { status: result.ok ? 200 : 409 });
    }
    if (!Number.isSafeInteger(jobId) || jobId <= 0) return NextResponse.json({ error: "jobIdが不正です。" }, { status: 400 });
    if (action === "text") return NextResponse.json(await updateAmateurXJobText(handle, jobId, String(body.mainText ?? ""), String(body.replyText ?? "")));
    if (action === "posted" || action === "skip") return NextResponse.json(await updateAmateurXJobStatus(handle, jobId, action === "posted" ? "posted" : "skipped", typeof body.xPostUrl === "string" ? body.xPostUrl : undefined, typeof body.mainText === "string" ? body.mainText : undefined, typeof body.replyText === "string" ? body.replyText : undefined));
    return NextResponse.json({ error: "この画面ではX API自動投稿を利用しません。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "処理に失敗しました。" }, { status: 409 });
  }
}

