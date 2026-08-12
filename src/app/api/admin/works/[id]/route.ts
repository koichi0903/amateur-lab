import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid work id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("works").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete work", error);
    return NextResponse.json({ error: "Failed to delete work" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
