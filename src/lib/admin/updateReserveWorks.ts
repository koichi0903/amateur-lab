import { supabase } from "@/lib/supabase";
import { getReserveItems } from "@/lib/playwright/getReserveItems";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { saveDmmItem } from "./save";
import { updateWork } from "./updateWork";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

import { UPDATE_CONFIG } from "@/config/update";

import {
  createBrowser,
  closeBrowser,
} from "@/lib/playwright/browserManager";

export async function updateReserveWorks() {
  const { products } =
    await getReserveItems();

  console.log(
    `予約作品 ${products.length}件`
  );

  const job = await beginJob(
    JOBS.RESERVE,
    products.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets =
  products.slice(processedCount);

let browser =
  await createBrowser();

try {
    const {
      data: works,
      error,
    } = await supabase
      .from("works")
      .select(`
        product_id,
        release_date
      `);

    if (error) {
      throw error;
    }

    const workMap = new Map(
      (works ?? []).map(
        (work: {
          product_id: string;
          release_date: string | null;
        }) => [
          work.product_id,
          work,
        ]
      )
    );

    let newCount = 0;
    let updateCount = 0;

    const BATCH_SIZE =
      UPDATE_CONFIG.parallel;

        for (
      let i = 0;
      i < targets.length;
      i += BATCH_SIZE
    ) {
      const batch = targets.slice(
        i,
        i + BATCH_SIZE
      );

      await Promise.all(
        batch.map(async (product) => {
          const item = await getDmmItem(
            product.productId
          );

          if (!item) {
            return;
          }

          const work = workMap.get(
            product.productId
          );

          // 新規登録
          if (!work) {
            console.log(
              "新規予約:",
              product.productId
            );

            await saveDmmItem(item);

await updateWork(
  product.productId,
  undefined,
  browser
);

await supabase
  .from("works")
  .update({
    stage: "RESERVE",
  })
  .eq(
    "product_id",
    product.productId
  );

newCount++;

return;
          }

          // 発売日変更
          if (
            work.release_date !==
            item.date
          ) {
            console.log(
              "発売日変更:",
              product.productId
            );

            await supabase
              .from("works")
              .update({
                release_date:
                  item.date,
              })
              .eq(
                "product_id",
                product.productId
              );

            await updateWork(
  product.productId,
  undefined,
  browser
);

            updateCount++;
          }
        })
      );

      const processed =
        processedCount +
        i +
        batch.length;

  if (
  processed %
    UPDATE_CONFIG.browserRestartInterval ===
  0
) {
  console.log(
    `🔄 Browser再起動 (${processed}件処理)`
  );

  await closeBrowser(browser);

  browser = await createBrowser();
}

      await updateJob(
        JOBS.RESERVE,
        processed,
        batch[batch.length - 1]
          .productId
      );

      console.log(
        `${processed}/${products.length}`
      );
    }

    await finishJob(
      JOBS.RESERVE
    );

    console.log({
      newCount,
      updateCount,
    });
  } catch (error) {
  await failJob(
    JOBS.RESERVE,
    error instanceof Error
      ? error.message
      : String(error)
  );

  throw error;
} finally {
  await closeBrowser(browser);
}
}