import { NextResponse } from "next/server";
import { selectDailyPlanCandidate } from "@/lib/xGrowthOperations";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { slotId?: string; candidateId?: string };
  if (!body.slotId || !body.candidateId) return NextResponse.json({ error: "slotId and candidateId are required." }, { status: 400 });
  const result = await selectDailyPlanCandidate({ slotId: body.slotId, candidateId: body.candidateId });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
