import { revalidatePublicCacheForTasks } from "@/lib/admin/revalidatePublicCache";
import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateReserveWorks } from "@/lib/admin/updateReserveWorks";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  const result = await updateReserveWorks();
  await revalidatePublicCacheForTasks(["reserve"], { workIds: result?.workIds });

  return Response.json({
    message: "予約作品更新完了",
  });
}
