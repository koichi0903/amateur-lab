import { NextResponse } from "next/server";

import { updateStage } from "@/lib/update/updateStage";

export async function POST() {
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