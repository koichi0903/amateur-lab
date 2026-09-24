import { revalidatePublicCacheForTasks } from "@/lib/admin/revalidatePublicCache";
import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateEndedSaleWorks } from "@/lib/admin/updateEndedSaleWorks";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  try {
  const result = await updateEndedSaleWorks();
    await revalidatePublicCacheForTasks(["ended-sale"], { workIds: result?.workIds });

return Response.json({
  success: true,
  completed: true,
  processedCount: result?.processedCount ?? 0,
  totalCount: result?.totalCount ?? 0,
  deferredCount: result?.deferredCount ?? 0,
  deferredProductIds: result?.deferredProductIds ?? [],
  message: result?.deferredCount
    ? `終了セール更新が完了しました（要再確認${result.deferredCount}件）。`
    : "終了セール更新が完了しました。",
});
  } catch (error) {
    console.error("update-ended-sale error:", error);

    return Response.json(
      {
        success: false,
        message: "終了セール更新に失敗しました。",
      },
      {
        status: 500,
      }
    );
  }
}
