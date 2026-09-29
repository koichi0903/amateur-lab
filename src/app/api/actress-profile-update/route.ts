import { NextRequest, NextResponse } from "next/server";
import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateActressProfiles } from "@/lib/admin/updateActressProfiles";

export async function POST(request: NextRequest) {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  const offset = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("offset") ?? "1", 10) || 1);
  try {
    const result = await updateActressProfiles(offset);
    return NextResponse.json({ success: true, ...result, message: result.completed ? "女優プロフィール補完が完了しました。" : `女優プロフィールを${result.offset}件目から補完しました。` });
  } catch (error) {
    console.error("[actress-profile-update]", error);
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "女優プロフィール補完に失敗しました。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
