import { NextResponse } from "next/server";

import { updateSaleWorks } from "@/lib/admin/updateSaleWorks";
import { updateEndedSaleWorks } from "@/lib/admin/updateEndedSaleWorks";
import { updateStatistics } from "@/lib/statistics/updateStatistics";


export async function POST() {
  try {
    console.log("===== セール更新開始 =====");

await updateSaleWorks();

await updateEndedSaleWorks();

await updateStatistics();

console.log("===== セール更新完了 =====");

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