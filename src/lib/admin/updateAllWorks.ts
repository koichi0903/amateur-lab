import { updateNewWorks } from "./updateNewWorks";
import { updateSemiNewWorks } from "./updateSemiNewWorks";
import { updateOldWorks } from "./updateOldWorks";
import { updateSaleWorks } from "./updateSaleWorks";
import { updateEndedSaleWorks } from "./updateEndedSaleWorks";
import { updateRanking } from "./updateRanking";
import { updateScore } from "./updateScore";

export async function updateAllWorks() {
  console.log("===== 全更新開始 =====");

  try {
    console.log("■ 新作更新");
    await updateNewWorks();

    console.log("■ 準新作更新");
await updateSemiNewWorks();

console.log("■ 旧作更新");
await updateOldWorks();

console.log("■ セール更新");
await updateSaleWorks();

console.log("■ 終了セール更新");
await updateEndedSaleWorks();

console.log("■ ランキング更新");
await updateRanking();

console.log("■ スコア更新");
await updateScore();

console.log("===== 全更新完了 =====");
  } catch (error) {
    console.error("全更新失敗", error);
    throw error;
  }
}