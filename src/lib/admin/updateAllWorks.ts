import { updateNewWorks } from "./updateNewWorks";
import { updateSemiNewWorks } from "./updateSemiNewWorks";
import { updateSaleWorks } from "./updateSaleWorks";
import { updateStatistics } from "@/lib/statistics/updateStatistics";

export async function updateAllWorks() {
  console.log("===== 全更新開始 =====");

  try {
    console.log("■ 新作更新");
    await updateNewWorks();

    console.log("■ 準新作更新");
    await updateSemiNewWorks();

    console.log("■ セール更新");
    await updateSaleWorks();

    console.log("■ 統計更新");
    await updateStatistics();

    console.log("===== 全更新完了 =====");
  } catch (error) {
    console.error("全更新失敗", error);
    throw error;
  }
}