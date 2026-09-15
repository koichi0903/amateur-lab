import { NextResponse } from "next/server";
import { updateOpportunityStatus, type XOpportunityStatus } from "@/lib/xGrowthOperations";

const statuses = new Set<XOpportunityStatus>(["candidate", "adopted", "rejected", "posted", "expired"]);

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = Number(payload?.id);
  const status = typeof payload?.status === "string" ? payload.status : "";
  const reason = typeof payload?.reason === "string" ? payload.reason : undefined;
  if (!Number.isSafeInteger(id) || id <= 0 || !statuses.has(status as XOpportunityStatus)) {
    return NextResponse.json({ error: "Invalid opportunity status request." }, { status: 400 });
  }
  const result = await updateOpportunityStatus(id, status as XOpportunityStatus, reason);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
