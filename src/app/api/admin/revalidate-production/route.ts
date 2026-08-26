import { NextRequest, NextResponse } from "next/server";

import { revalidateProduction } from "@/lib/admin/revalidateProduction";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { tasks?: unknown } | null;
  const tasks = Array.isArray(payload?.tasks)
    ? payload.tasks.filter((task): task is string => typeof task === "string")
    : [];
  if (tasks.length === 0) {
    return NextResponse.json({ success: false, message: "更新対象がありません" }, { status: 400 });
  }

  try {
    await revalidateProduction(tasks);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("manual revalidation failed:", message);
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
