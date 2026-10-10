import { NextRequest, NextResponse } from "next/server";
import { syncMetricSnapshots, type XSnapshotAge } from "@/lib/xGrowthOperations";
import { isAdminRequest } from "@/lib/admin/requestAuth";

const ages = new Set<XSnapshotAge>(["1h", "6h", "24h", "72h"]);

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: "管理画面の認証が必要です。" }, { status: 401 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const age = typeof payload?.age === "string" ? payload.age : "24h";
  if (!ages.has(age as XSnapshotAge)) {
    return NextResponse.json({ error: "Invalid snapshot age." }, { status: 400 });
  }
  const result = await syncMetricSnapshots(age as XSnapshotAge);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, saved: result.saved });
}
