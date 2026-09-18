import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/requestAuth";
import { prepareBijyoVideo } from "@/lib/bijyoReservedAutoPost";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobId = Number(request.nextUrl.searchParams.get("jobId"));
  if (!Number.isSafeInteger(jobId) || jobId <= 0) return NextResponse.json({ error: "jobIdが不正です。" }, { status: 400 });
  try {
    const result = await prepareBijyoVideo(jobId);
    return new NextResponse(new Uint8Array(result.bytes), { headers: { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
