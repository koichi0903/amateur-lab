import { syncNewWorks } from "./syncNewWorks";
import { updateStage } from "./updateStage";

export async function syncWorks() {
  console.log("================================");
  console.log("作品同期開始");
  console.log("================================");

  // 新作追加
  await syncNewWorks();

  // Stage更新
  await updateStage();

  console.log("================================");
  console.log("作品同期完了");
  console.log("================================");
}