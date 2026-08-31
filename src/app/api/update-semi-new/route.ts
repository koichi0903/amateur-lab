import { NextResponse } from "next/server";

import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateSemiNewWorks } from "@/lib/admin/updateSemiNewWorks";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    await updateSemiNewWorks();

    return NextResponse.json({
      success: true,
      message: "準新作更新が完了しました",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "準新作更新に失敗しました",
      },
      {
        status: 500,
      }
    );
  }
}
