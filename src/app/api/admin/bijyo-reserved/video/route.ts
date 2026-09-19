import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { prepareBijyoVideo } from "@/lib/bijyoReservedAutoPost";

export const dynamic = "force-dynamic";

function parseRange(value: string | null, size: number) {
  if (!value?.startsWith("bytes=") || size <= 0) return null;
  const [raw] = value.slice(6).split(",");
  const match = /^(\d*)-(\d*)$/.exec(raw.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobId = Number(request.nextUrl.searchParams.get("jobId"));
  const workIdValue = request.nextUrl.searchParams.get("workId");
  const workId = workIdValue == null ? undefined : Number(workIdValue);
  const inline = request.nextUrl.searchParams.get("preview") === "1";
  if (!Number.isSafeInteger(jobId) || jobId <= 0) return NextResponse.json({ error: "jobIdが不正です。" }, { status: 400 });
  if (workId !== undefined && (!Number.isSafeInteger(workId) || workId <= 0)) return NextResponse.json({ error: "workIdが不正です。" }, { status: 400 });
  try {
    const result = await prepareBijyoVideo(jobId, workId);
    const bytes = result.bytes;
    const range = parseRange(request.headers.get("range"), bytes.byteLength);
    const headers = new Headers({ "Content-Type": "video/mp4", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${result.filename}"`, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
    if (!range) {
      headers.set("Content-Length", String(bytes.byteLength));
      return new NextResponse(new Uint8Array(bytes), { status: request.headers.has("range") ? 416 : 200, headers: request.headers.has("range") ? new Headers({ ...Object.fromEntries(headers), "Content-Range": `bytes */${bytes.byteLength}` }) : headers });
    }
    const body = bytes.subarray(range.start, range.end + 1);
    headers.set("Content-Length", String(body.byteLength));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
    return new NextResponse(new Uint8Array(body), { status: 206, headers });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && Number((error as { status?: unknown }).status) === 404 ? 404 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
