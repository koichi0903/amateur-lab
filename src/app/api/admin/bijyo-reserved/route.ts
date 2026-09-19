import { NextRequest, NextResponse } from "next/server";
import { createBijyoManualJob, excludeBijyoJob, getBijyoDashboard, markBijyoPosted, prepareBijyoVideo, skipBijyoJob } from "@/lib/bijyoReservedAutoPost";
import { isAdminRequest } from "@/lib/admin/requestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getBijyoDashboard());
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const jobId = Number(body.jobId);
  const workId = Number(body.workId);
  let result: { ok: boolean; error?: string; jobId?: number; existing?: boolean };
  if (!Number.isSafeInteger(jobId) && ["posted", "skip", "exclude"].includes(action)) return NextResponse.json({ error: "jobIdが不正です。" }, { status: 400 });
  if (action === "posted") result = await markBijyoPosted(jobId);
  else if (action === "skip") result = await skipBijyoJob(jobId);
  else if (action === "exclude") result = await excludeBijyoJob(jobId);
  else if (action === "manual") {
    if (!Number.isSafeInteger(workId) || workId <= 0) return NextResponse.json({ error: "workIdが不正です。" }, { status: 400 });
    result = await createBijyoManualJob(workId);
    if (result.ok && result.jobId) {
      try {
        await prepareBijyoVideo(result.jobId, workId);
        return NextResponse.json({ ...result, trim: { ok: true } });
      } catch (error) {
        return NextResponse.json({ ...result, trim: { ok: false, error: error instanceof Error ? error.message : String(error) } });
      }
    }
  } else return NextResponse.json({ error: "この画面ではX API自動投稿を利用しません。" }, { status: 400 });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
