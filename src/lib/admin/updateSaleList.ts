import { initializeSaleStatus } from "./initializeSaleStatus";

export async function updateSaleList() {
  const { matchedWorks } = await initializeSaleStatus();

  if (matchedWorks.length === 0) {
    console.log("更新対象なし");
    return [];
  }

  console.log(
    `セール作品 ${matchedWorks.length} 件を検出しました。`
  );

  return matchedWorks;
}