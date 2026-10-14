import { NextRequest, NextResponse } from "next/server";
import { getBijyoManualJobsPage } from "@/lib/bijyoManualJobs";
import { isAdminRequest } from "@/lib/admin/requestAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const traceId = crypto.randomUUID().slice(0, 8);
  const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return NextResponse.json({ error: "pageが不正です。" }, { status: 400 });

  console.info(`[bijyo-manual-jobs] trace=${traceId} stage=request-start page=${page}`);
  const authStartedAt = performance.now();
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  console.info(`[bijyo-manual-jobs] trace=${traceId} stage=auth-done ms=${Math.round((performance.now() - authStartedAt) * 100) / 100}`);

  const result = await getBijyoManualJobsPage(page, traceId);
  const status = result.error ? 500 : 200;
  const serializeStartedAt = performance.now();
  const body = JSON.stringify(result);
  const serializeMs = Math.round((performance.now() - serializeStartedAt) * 100) / 100;
  console.info(`[bijyo-manual-jobs] trace=${traceId} stage=response-ready status=${status} jobs=${result.jobs.length} total=${result.total} serializeMs=${serializeMs} bytes=${Buffer.byteLength(body)} totalMs=${Math.round((performance.now() - startedAt) * 100) / 100}`);
  return new NextResponse(body, { status, headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" } });
}
