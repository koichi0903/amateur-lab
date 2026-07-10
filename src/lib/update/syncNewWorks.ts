import { supabase } from "@/lib/supabase";

import { getNewItems } from "@/lib/playwright/getNewItems";
import { getDmmItem } from "@/lib/dmm/getDmmItem";

import { saveDmmItem } from "@/lib/admin/save";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

import {
  beginJob,
  finishJob,
  failJob,
  updateJob,
  JOBS,
} from "@/lib/jobs";

const DMM_PARALLEL = 5;
const JOB_SAVE_INTERVAL = 6;

export async function syncNewWorks() {
  const startedAt = Date.now();

  const { productIds } = await getNewItems();

  const job = await beginJob(
    JOBS.NEW,
    productIds.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets =
    productIds.slice(processedCount);

  try {
    const { data: works, error } = await supabase
      .from("works")
      .select("product_id");

    if (error) {
      throw error;
    }

    const existingIds = new Set(
      (works ?? []).map((w) => w.product_id)
    );

    let processed = processedCount;
    let inserted = 0;
    let skipped = 0;

    console.log("================================");
    console.log("🚀 新作同期開始");
    console.log("================================");
    console.log(`取得件数 : ${productIds.length}`);
    console.log(`途中再開 : ${processedCount}件`);
    console.log("================================");

    for (
      let i = 0;
      i < targets.length;
      i += DMM_PARALLEL
    ) {
      const batch = targets.slice(
        i,
        i + DMM_PARALLEL
      );

      const items = await Promise.all(
        batch.map(async (productId) => {
          if (existingIds.has(productId)) {
            return {
              productId,
              item: null,
              exists: true,
            };
          }

          const item =
            await getDmmItem(productId);

          return {
            productId,
            item,
            exists: false,
          };
        })
      );

      for (const row of items) {
        if (row.exists) {
          skipped++;
          processed++;
          continue;
        }

        if (!row.item) {
          processed++;
          continue;
        }

        const saved =
          await saveDmmItem(row.item);

        if (saved) {
          inserted++;

          await updatePlaywrightItem(
            row.productId
          );
        }

        processed++;

        if (
          processed % JOB_SAVE_INTERVAL ===
          0
        ) {
          await updateJob(
            JOBS.NEW,
            processed,
            row.productId
          );

          console.log(
            `${processed}/${productIds.length}`
          );
        }
      }
    }

    await updateJob(
      JOBS.NEW,
      processed,
      targets.at(-1) ?? ""
    );

    await finishJob(JOBS.NEW);

    console.log("================================");
    console.log("✅ 新作同期完了");
    console.log(`登録 : ${inserted}件`);
    console.log(`スキップ : ${skipped}件`);
    console.log(
      `処理時間 : ${Math.round(
        (Date.now() - startedAt) / 1000
      )}秒`
    );
    console.log("================================");
  } catch (error) {
    await failJob(
      JOBS.NEW,
      error instanceof Error
        ? error.message
        : String(error)
    );

    throw error;
  }
}