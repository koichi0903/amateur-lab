import { NextRequest, NextResponse } from "next/server";
import { syncMetricSnapshots, type XSnapshotAge } from "@/lib/xGrowthOperations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ages: XSnapshotAge[] = ["1h", "6h", "24h", "72h"];

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const results = [];
  for (const age of ages) {
    const result = await syncMetricSnapshots(age);
    if (result.error) {
      return NextResponse.json({ error: result.error, completed: results }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
    results.push({ age, saved: result.saved, ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}) });
  }

  return NextResponse.json({ ok: true, capturedAt: new Date().toISOString(), results }, { headers: { "Cache-Control": "no-store" } });
}
