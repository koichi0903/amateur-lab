import { updateNewWorks } from "@/lib/admin/updateNewWorks";
import { updateStage } from "@/lib/update/updateStage";

export async function run0330() {
  console.log("===== 03:30 更新開始 =====");

  console.log("Cron: NEW");
  await updateNewWorks();

  console.log("Cron: STAGE");
  await updateStage();

  console.log("===== 03:30 更新終了 =====");
}