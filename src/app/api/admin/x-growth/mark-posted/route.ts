import { NextResponse } from "next/server";
import { recordManualXPost } from "@/lib/xGrowthOperations";
import { parseManualXPostPayload } from "@/lib/x-growth/xGrowthManualPostPayload";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as unknown;
  const parsed = parseManualXPostPayload(payload);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await recordManualXPost(parsed.input);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
