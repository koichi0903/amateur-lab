import { supabase } from "@/lib/supabase";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { updateDmmItem } from "@/lib/admin/update";
import { updateStatistics } from "@/lib/statistics/updateStatistics";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

export async function updateAllWorks() {
  const works: {
    id: number;
    product_id: string;
  }[] = [];

  let from = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select("id, product_id")
      .range(from, from + limit - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    works.push(...data);

    if (data.length < limit) {
      break;
    }

    from += limit;
  }

  console.log(`取得件数: ${works.length}`);

  if (works.length === 0) {
    return;
  }

  const batchSize = 10;

  for (let i = 0; i < works.length; i += batchSize) {
    const batch = works.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (work) => {
        try {
          if (!work.product_id) {
            return;
          }

          const item = await getDmmItem(work.product_id);

          if (!item) {
            console.log(
              "DMMで取得できない:",
              work.product_id
            );
            return;
          }

          // DMM情報更新
          await updateDmmItem(item);

          // Playwright情報更新
          await updatePlaywrightItem(
            work.product_id
          );

          console.log(
            "更新完了:",
            work.product_id
          );
        } catch (error) {
          console.error(
            "更新失敗:",
            work.product_id,
            error
          );
        }
      })
    );
  }

  // ランキング・統計更新
  await updateStatistics();

  console.log("全作品更新完了");
}