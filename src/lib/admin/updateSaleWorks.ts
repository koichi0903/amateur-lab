import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { UPDATE_CONFIG } from "@/config/update";
import { updateSaleList } from "./updateSaleList";

export async function updateSaleWorks() {
  const works = await updateSaleList();

  if (works.length === 0) {
    console.log("更新対象なし");
    return;
  }

  console.log(`${works.length}件更新開始`);

  for (
    let i = 0;
    i < works.length;
    i += UPDATE_CONFIG.parallel
  ) {
    const batch = works.slice(
      i,
      i + UPDATE_CONFIG.parallel
    );

    await Promise.all(
      batch.map(async (work) => {
        try {
          await updatePlaywrightItem(work.product_id);

          console.log(
            `✓ ${work.product_id}`
          );
        } catch (error) {
          console.error(
            `✗ ${work.product_id}`,
            error
          );
        }
      })
    );
  }

  console.log("セール更新完了");
}