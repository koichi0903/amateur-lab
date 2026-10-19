import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { getAmateurXJobVideo, normalizeXHandle } from "@/lib/fanzaAmateurXManualPost";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const handle = normalizeXHandle(request.nextUrl.searchParams.get("account"));
  const jobId = Number(request.nextUrl.searchParams.get("jobId"));
  const trimStartSeconds = Number(request.nextUrl.searchParams.get("trimStart") ?? 0);
  if (!handle || !Number.isSafeInteger(jobId) || jobId <= 0 || !Number.isFinite(trimStartSeconds) || trimStartSeconds < 0 || trimStartSeconds > 600) {
    return NextResponse.json({ error: "動画指定が不正です。" }, { status: 400 });
  }
  let temporaryDirectory: string | null = null;
  try {
    const result = await getAmateurXJobVideo(handle, jobId, trimStartSeconds);
    temporaryDirectory = result.dir;
    const fileInfo = await stat(result.file);
    const stream = createReadStream(result.file);
    stream.once("close", () => {
      if (temporaryDirectory) void rm(temporaryDirectory, { recursive: true, force: true });
    });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(fileInfo.size),
      "Cache-Control": "no-store",
    } });
  } catch (error) {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "動画を準備できませんでした。" }, { status: 500 });
  }
}

