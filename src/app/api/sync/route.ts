import { NextResponse } from "next/server";

import { syncWorks } from "@/lib/update/syncWorks";

export async function POST() {
  try {
    await syncWorks();

    return NextResponse.json({
      success: true,
      message: "作品同期が完了しました。",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "同期に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}