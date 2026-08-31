import { NextResponse } from "next/server";

import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { initializeSemiNewWorks } from "@/lib/admin/initializeSemiNewWorks";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    await initializeSemiNewWorks();

    return NextResponse.json({
      success: true,
      message: "準新作初期登録が完了しました。",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "準新作初期登録に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}
