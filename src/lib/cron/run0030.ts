import { updateSaleWorks } from "@/lib/admin/updateSaleWorks";
import { updateEndedSaleWorks } from "@/lib/admin/updateEndedSaleWorks";
import { updateScore } from "@/lib/admin/updateScore";
import { updateStage } from "@/lib/update/updateStage";
import { updateReserveWorks } from "@/lib/admin/updateReserveWorks";
import { updateNewWorks } from "@/lib/admin/updateNewWorks";

export async function run0030() {
  console.log("===== セール更新ルーティン開始 =====");

  console.log("Cron: SALE");
  await updateSaleWorks();

  console.log("Cron: ENDED_SALE");
  await updateEndedSaleWorks();

  console.log("Cron: STAGE");
  await updateStage();

      console.log("Cron: RESERVE");
  await updateReserveWorks();

  console.log("Cron: NEW");
  await updateNewWorks();

  console.log("Cron: SCORE");
  await updateScore();

  console.log("===== セール更新ルーティン終了 =====");
}