import { updateReserveWorks } from "@/lib/admin/updateReserveWorks";

export async function POST() {
  await updateReserveWorks();

  return Response.json({
    message: "予約作品更新完了",
  });
}