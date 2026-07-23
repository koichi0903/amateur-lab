import { supabase } from "@/lib/supabase";
import { getReserveItems } from "@/lib/playwright/getReserveItems";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { saveDmmItem } from "@/lib/admin/save";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

import {
  createBrowser,
  closeBrowser,
} from "@/lib/playwright/browserManager";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

export async function syncReserveWorks() {
  const { products } = await getReserveItems();

  const job = await beginJob(
    JOBS.RESERVE,
    products.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets =
    products.slice(processedCount);

  console.log(
    `予約作品同期開始 (${processedCount}/${products.length})`
  );

  let browser = await createBrowser();
  let current = processedCount;

  try {
    for (const item of targets) {
      const { data: existing } = await supabase
        .from("works")
        .select("product_id,list_price")
        .eq("product_id", item.productId)
        .maybeSingle();

      if (existing) {
        if (
          existing.list_price !== item.listPrice
        ) {
          await updatePlaywrightItem(
            item.productId,
            undefined,
            browser,
            item.listPrice
          );
        }

        current++;

        await updateJob(
          JOBS.RESERVE,
          current,
          item.productId
        );

        continue;
      }

      console.log(
        `[NEW RESERVED] ${item.productId}`
      );

      const dmmItem = await getDmmItem(
        item.productId
      );

      if (!dmmItem) {
        console.log(
          `[SKIP] DMM取得失敗 ${item.productId}`
        );

        current++;

        continue;
      }

            await saveDmmItem(
  dmmItem,
  undefined,
  "RESERVED"
);

      await updatePlaywrightItem(
        item.productId,
        undefined,
        browser,
        item.listPrice
      );

      current++;

      if (current % 100 === 0) {
        console.log(
          `🔄 Browser再起動 (${current}件処理)`
        );

        await closeBrowser(browser);

        browser = await createBrowser();
      }

      await updateJob(
        JOBS.RESERVE,
        current,
        item.productId
      );
    }

    await finishJob(JOBS.RESERVE);

    console.log("予約作品同期完了");
  } catch (error) {
    console.error(
      "syncReserveWorks エラー:",
      error
    );

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