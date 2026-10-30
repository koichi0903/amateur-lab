import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { createAmateurXJob, getAmateurXDashboard, skipAmateurXCandidate, updateAmateurXJobStatus, updateAmateurXJobText } from "@/lib/fanzaAmateurXManualPost";

export const dynamic = "force-dynamic";

function validLane(value: unknown): value is "new_release" | "popular" {
  return value === "new_release" || value === "popular";
}

type CandidateInput = { contentId: string; lane: "new_release" | "popular" };

function parseCandidateInput(body: Record<string, unknown>): CandidateInput | null {
  const contentId = String(body.contentId ?? "").trim();
  if (!contentId || contentId.length > 120 || !validLane(body.lane)) return null;
  return { contentId, lane: body.lane };
}

function isValidJobId(jobId: number) {
  return Number.isSafeInteger(jobId) && jobId > 0;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

async function addCandidate(body: Record<string, unknown>) {
  const input = parseCandidateInput(body);
  if (!input) return NextResponse.json({ error: "作品または候補の種類が不正です。" }, { status: 400 });
  const result = await createAmateurXJob(input.contentId, input.lane);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}

async function skipCandidate(body: Record<string, unknown>) {
  const input = parseCandidateInput(body);
  if (!input) return NextResponse.json({ error: "作品または候補の種類が不正です。" }, { status: 400 });
  const result = await skipAmateurXCandidate(input.contentId, input.lane);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}

async function updateJobText(body: Record<string, unknown>, jobId: number) {
  const result = await updateAmateurXJobText(jobId, String(body.mainText ?? ""), String(body.replyText ?? ""));
  return NextResponse.json(result);
}

async function updateJobStatus(body: Record<string, unknown>, jobId: number) {
  const status = body.action === "posted" ? "posted" : "skipped";
  const result = await updateAmateurXJobStatus(jobId, status, stringOrUndefined(body.xPostUrl), stringOrUndefined(body.mainText), stringOrUndefined(body.replyText));
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const lane = request.nextUrl.searchParams.get("lane");
  const page = Math.max(1, Math.trunc(Number(request.nextUrl.searchParams.get("page") ?? 1) || 1));
  if (!validLane(lane)) return NextResponse.json({ error: "候補の種類が不正です。" }, { status: 400 });
  try { return NextResponse.json(await getAmateurXDashboard(lane, page)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "候補を取得できませんでした。" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const jobId = Number(body.jobId);
  try {
    if (action === "add") return await addCandidate(body);
    if (action === "skip_candidate") return await skipCandidate(body);
    if (!isValidJobId(jobId)) return NextResponse.json({ error: "jobIdが不正です。" }, { status: 400 });
    if (action === "text") return await updateJobText(body, jobId);
    if (action === "posted" || action === "skip") return await updateJobStatus(body, jobId);
    return NextResponse.json({ error: "この画面ではX API自動投稿を利用しません。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "処理に失敗しました。" }, { status: 409 });
  }
}

