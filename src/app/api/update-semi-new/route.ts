import { NextResponse } from "next/server";

import { updateSemiNewWorks } from "@/lib/admin/updateSemiNewWorks";

export async function POST() {
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