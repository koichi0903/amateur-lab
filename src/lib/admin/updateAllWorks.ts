import { UPDATE_CONFIG } from "@/config/update";
import { updateStatistics } from "@/lib/statistics/updateStatistics";

import { updateNewWorks } from "./updateNewWorks";
import { updateSemiNewWorks } from "./updateSemiNewWorks";
import { updateSaleWorks } from "./updateSaleWorks";

export async function updateAllWorks() {
  console.log("========== 更新開始 ==========");

  // 新作は毎日
  await updateNewWorks();

  // 準新作は設定曜日のみ
  const today = new Date().getDay();

  if (
    UPDATE_CONFIG.semiNewUpdateDays.includes(today)
  ) {
    await updateSemiNewWorks();
  } else {
    console.log("準新作更新はスキップ");
  }

  // セール更新
  await updateSaleWorks();

  // ランキング・統計更新
  await updateStatistics();

  console.log("========== 更新完了 ==========");
}