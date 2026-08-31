import { NextResponse } from "next/server";

import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateOldWorks } from "@/lib/admin/updateOldWorks";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    await updateOldWorks();

    return NextResponse.json({
      success: true,
      message: "旧作更新が完了しました。",
    });
  } catch (error) {
    console.error("update-old error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "旧作更新に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}
