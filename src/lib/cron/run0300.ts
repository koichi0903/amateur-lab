import { updateReserveWorks } from "@/lib/admin/updateReserveWorks";
import { updateStage } from "@/lib/update/updateStage";

export async function run0300() {
  console.log("===== 03:00 更新開始 =====");

  console.log("Cron: RESERVE");
  await updateReserveWorks();

  console.log("Cron: STAGE");
  await updateStage();

  console.log("===== 03:00 更新終了 =====");
}