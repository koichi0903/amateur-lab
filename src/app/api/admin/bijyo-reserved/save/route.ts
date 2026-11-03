import { NextRequest, NextResponse } from "next/server";
import { getPreparedBijyoVideo } from "@/lib/bijyoReservedAutoPost";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { PreparedVideoAlreadyExistsError, PreparedVideoNotFoundError, savePreparedBijyoVideoToDesktop } from "@/lib/bijyoTrimmedVideoStore";
import { isLocalhost, isSameLocalOrigin } from "@/lib/localOriginValidation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function saveErrorResponse(error: unknown) {
  if (error instanceof PreparedVideoAlreadyExistsError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof PreparedVideoNotFoundError || (error && typeof error === "object" && "status" in error && Number((error as { status?: unknown }).status) === 404)) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存できる準備済み動画がありません。" }, { status: 404 });
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "保存に失敗しました。" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  if (!isLocalhost(request.nextUrl.hostname)) return NextResponse.json({ error: "この保存機能はWindows上のlocalhostでのみ使えます。" }, { status: 403 });
  if (!isSameLocalOrigin({
    requestHostname: request.nextUrl.hostname,
    host: request.headers.get("host"),
    requestProtocol: request.nextUrl.protocol,
    forwardedProtocol: request.headers.get("x-forwarded-proto"),
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  })) return NextResponse.json({ error: "同じローカル画面からのリクエストだけ許可されています。" }, { status: 403 });
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const jobId = Number(body.jobId);
  const workId = Number(body.workId);
  if (!Number.isSafeInteger(jobId) || jobId <= 0 || !Number.isSafeInteger(workId) || workId <= 0) {
    return NextResponse.json({ error: "jobIdまたはworkIdが不正です。" }, { status: 400 });
  }

  try {
    const prepared = await getPreparedBijyoVideo(jobId, workId);
    const saved = await savePreparedBijyoVideoToDesktop(workId, prepared.bytes);
    return NextResponse.json({ ok: true, filename: saved.filename, path: saved.path });
  } catch (error) {
    return saveErrorResponse(error);
  }
}
