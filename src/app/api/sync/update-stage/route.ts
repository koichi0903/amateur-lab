import { NextResponse } from "next/server";

import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateStage } from "@/lib/update/updateStage";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    await updateStage();

    return NextResponse.json({
      success: true,
      message: "Stage同期が完了しました",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Stage同期に失敗しました",
      },
      {
        status: 500,
      }
    );
  }
}
