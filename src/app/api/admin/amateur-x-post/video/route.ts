import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { getAmateurXJobVideo } from "@/lib/fanzaAmateurXManualPost";
import { parseAmateurXVideoRequest } from "@/lib/amateurXVideoRequest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const parsed = parseAmateurXVideoRequest(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: "動画指定が不正です。" }, { status: 400 });
  }
  const { jobId, trimStartSeconds, trimEndSeconds } = parsed.value;
  let temporaryDirectory: string | null = null;
  try {
    const result = await getAmateurXJobVideo(jobId, trimStartSeconds, trimEndSeconds);
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

