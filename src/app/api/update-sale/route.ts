import { NextResponse } from "next/server";

import { revalidatePublicCacheForTasks } from "@/lib/admin/revalidatePublicCache";
import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateSaleWorks } from "@/lib/admin/updateSaleWorks";
import { updateStatistics } from "@/lib/statistics/updateStatistics";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
    console.log("===== セール更新開始 =====");

    const result = await updateSaleWorks();

    await updateStatistics();
    await revalidatePublicCacheForTasks(["sale"], { workIds: result?.workIds });

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
      },
    );
  }
}
