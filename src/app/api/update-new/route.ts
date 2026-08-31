import { NextResponse } from "next/server";

import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateNewWorks } from "@/lib/admin/updateNewWorks";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    await updateNewWorks();

    return NextResponse.json({
      success: true,
      message: "新作更新が完了しました",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "新作更新に失敗しました",
      },
      {
        status: 500,
      }
    );
  }
}
