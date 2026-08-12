import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAndSaveInsight } from "@/lib/insights/generateAndSave";
import type { Work } from "@/types/work";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const workId =
    body && typeof body === "object" && "workId" in body
      ? (body as { workId?: unknown }).workId
      : null;

  if (!Number.isInteger(workId) || Number(workId) <= 0) {
    return NextResponse.json({ error: "Invalid work id" }, { status: 400 });
  }

  const { data: work, error } = await supabaseAdmin
    .from("works")
    .select("*")
    .eq("id", Number(workId))
    .maybeSingle();

  if (error) {
    console.error("Failed to load work for insights", error);
    return NextResponse.json({ error: "Failed to load work" }, { status: 500 });
  }
  if (!work) {
    return NextResponse.json({ error: "Work not found" }, { status: 404 });
  }

  await generateAndSaveInsight(work as Work);
  return NextResponse.json({ success: true });
}
