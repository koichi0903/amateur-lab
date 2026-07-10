import { NextResponse } from "next/server";

import { updateSaleWorks } from "@/lib/admin/updateSaleWorks";

export async function POST() {
  try {
    await updateSaleWorks();

    return NextResponse.json({
      success: true,
      message: "セール更新が完了しました",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "セール更新に失敗しました",
      },
      {
        status: 500,
      }
    );
  }
}