import { NextResponse } from "next/server";

import { syncWorks } from "@/lib/update/syncWorks";
import { updateAllWorks } from "@/lib/admin/updateAllWorks";

export async function POST() {
  try {
    await syncWorks();

    await updateAllWorks();

    return NextResponse.json({
      success: true,
      message: "全更新が完了しました。",
    });
  } catch (error) {
    console.error("update-all error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "全更新に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}