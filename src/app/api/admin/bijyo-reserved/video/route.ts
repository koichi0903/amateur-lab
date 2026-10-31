import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { prepareBijyoVideo } from "@/lib/bijyoReservedAutoPost";
import { parseBijyoVideoQueryParams, projectByteRangeBody } from "@/lib/bijyoVideoByteRange";

export const dynamic = "force-dynamic";

function videoErrorResponse(error: unknown) {
  const status = error && typeof error === "object" && "status" in error && Number((error as { status?: unknown }).status) === 404 ? 404 : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status });
}

function videoResponse(request: NextRequest, bytes: Uint8Array, filename: string, inline: boolean) {
  const projection = projectByteRangeBody(bytes, request.headers.get("range"));
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Length": String(projection.body.byteLength),
  });
  if (projection.contentRange) headers.set("Content-Range", projection.contentRange);
  return new NextResponse(new Uint8Array(projection.body), { status: projection.status, headers });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = parseBijyoVideoQueryParams(request.nextUrl.searchParams);
  if (!query.ok) return NextResponse.json({ error: query.error }, { status: 400 });
  try {
    const result = await prepareBijyoVideo(query.jobId, query.workId);
    return videoResponse(request, result.bytes, result.filename, query.inline);
  } catch (error) {
    return videoErrorResponse(error);
  }
}
