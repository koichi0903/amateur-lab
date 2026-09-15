import { NextResponse } from "next/server";
import { executeOpportunityPost } from "@/lib/xGrowthOperations";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = Number(payload?.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid opportunity id." }, { status: 400 });
  }
  const result = await executeOpportunityPost(id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true, xPostId: result.postId });
}
