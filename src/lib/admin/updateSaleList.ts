import { initializeSaleStatus } from "./initializeSaleStatus";
import { getSaleItems } from "../playwright/getSaleItems";

export async function updateSaleList() {
  // Playwrightでセール一覧取得
  const { products, totalPages } = await getSaleItems();

  console.log(
    `Playwrightで ${products.length} 件取得（全${totalPages}ページ）`
  );

  // DB照合・is_on_sale更新
  const { matchedWorks } =
    await initializeSaleStatus(
  products.map((p) => p.productId)
);

  if (matchedWorks.length === 0) {
    console.log("更新対象なし");
    return [];
  }

  console.log(
    `セール作品 ${matchedWorks.length} 件を検出しました。`
  );

  return matchedWorks;
}