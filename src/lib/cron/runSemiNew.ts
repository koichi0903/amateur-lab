import { updateSemiNewWorks } from "@/lib/admin/updateSemiNewWorks";
import { updateReviewWorks } from "@/lib/admin/updateReviewWorks";

export async function runSemiNew() {
  console.log("===== 日曜14:00 更新開始 =====");

  console.log("Cron: SEMI_NEW");
await updateSemiNewWorks();

console.log("Cron: REVIEW");
await updateReviewWorks();

console.log("===== 日曜14:00 更新終了 =====");
}