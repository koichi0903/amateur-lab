import { updateSemiNewWorks } from "@/lib/admin/updateSemiNewWorks";

export async function runSunday1400() {
  console.log("===== 日曜14:00 更新開始 =====");

  console.log("Cron: SEMI_NEW");
  await updateSemiNewWorks();

  console.log("===== 日曜14:00 更新終了 =====");
}