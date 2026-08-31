import { blockVercelAdminUpdate } from "@/lib/admin/updateGuard";
import { updateReserveWorks } from "@/lib/admin/updateReserveWorks";

export async function POST() {
  const blocked = blockVercelAdminUpdate();
  if (blocked) return blocked;

  await updateReserveWorks();

  return Response.json({
    message: "予約作品更新完了",
  });
}
