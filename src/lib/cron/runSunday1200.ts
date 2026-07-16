import { updateOldWorks } from "@/lib/admin/updateOldWorks";

export async function runSunday1200() {
  console.log("===== 日曜12:00 更新開始 =====");

  console.log("Cron: OLD");
  await updateOldWorks();

  console.log("===== 日曜12:00 更新終了 =====");
}