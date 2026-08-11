import { updateSaleWorks } from "@/lib/admin/updateSaleWorks";
import { updateEndedSaleWorks } from "@/lib/admin/updateEndedSaleWorks";
import { updateScore } from "@/lib/admin/updateScore";
import { updateOldWorks } from "@/lib/admin/updateOldWorks";
import { updateStage } from "@/lib/update/updateStage";

export async function run1030() {
  console.log("===== 昼更新ルーティン開始 =====");

  console.log("Cron: SALE");
  await updateSaleWorks();

  console.log("Cron: ENDED_SALE");
  await updateEndedSaleWorks();

  console.log("Cron: STAGE");
  await updateStage();

    console.log("Cron: OLD");
  await updateOldWorks();

  console.log("Cron: SCORE");
  await updateScore();

  console.log("===== 昼更新ルーティン終了 =====");
}