import { supabase } from "@/lib/supabase";
import { UPDATE_CONFIG } from "@/config/update";
import { getReserveItems } from "@/lib/playwright/getReserveItems";
import { updateWork } from "./updateWork";

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

export async function updateReserveWorks() {
  const works: {
    product_id: string;
    release_date: string;
    list_price: number | null;
    sale_price: number | null;
  }[] = [];

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "product_id, release_date, list_price, sale_price, stage"
      )
      .eq("stage", "RESERVED")
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    works.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  if (works.length === 0) {
    console.log("更新対象の予約作品はありません");
    return;
  }

  const { products } = await getReserveItems();

  const productMap = new Map(
    products.map((p) => [p.productId, p])
  );

  const job = await beginJob(
    JOBS.RESERVE,
    works.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets =
    works.slice(processedCount);

  console.log(
    `予約作品更新開始 (${processedCount}/${works.length}から再開)`
  );

  let current = processedCount;
  let browser = await createBrowser();

  try {
    for (
      let i = 0;
      i < targets.length;
      i += UPDATE_CONFIG.parallel
    ) {
      const batch = targets.slice(
        i,
        i + UPDATE_CONFIG.parallel
      );

      await Promise.all(
        batch.map(async (work) => {
          const latest = productMap.get(
            work.product_id
          );

          // RESERVED一覧から消えたら NEWへ
          if (!latest) {
            const { error } =
              await supabase
                .from("works")
                .update({
                  stage: "NEW",
                })
                .eq(
                  "product_id",
                  work.product_id
                );

            if (error) {
              console.error(
                `[ERROR] Stage更新失敗 ${work.product_id}`,
                error
              );
              return;
            }

            console.log(
              `[STAGE] ${work.product_id} RESERVED → NEW`
            );

            return;
          }

          const dbPrice =
            work.sale_price ??
            work.list_price;

          const latestPrice =
            latest.salePrice ??
            latest.listPrice;

          if (
            dbPrice != null &&
            latestPrice != null &&
            dbPrice === latestPrice
          ) {
            console.log(
              `[SKIP] ${work.product_id} price=${dbPrice}`
            );

            return;
          }

          console.log(
            `[UPDATE] ${work.product_id} ${dbPrice} → ${latestPrice}`
          );

          try {
            await updateWork(
              work.product_id,
              null,
              browser,
              latest.listPrice
            );
          } catch (error) {
            console.error(
              `[ERROR] update失敗 ${work.product_id}`,
              error
            );
          }

          return;
        })
      );

            // Promise.all が終わった時点で、この batch は全件成功
      current += batch.length;

      if (
        current %
          UPDATE_CONFIG.browserRestartInterval ===
        0
      ) {
        console.log(
          `🔄 Browser再起動 (${current}件処理)`
        );

        await closeBrowser(browser);

        browser = await createBrowser();
      }

      // 10件ごと、または最後だけ保存
      const lastWork =
        batch[batch.length - 1];

      await updateJob(
        JOBS.RESERVE,
        current,
        lastWork.product_id
      );

      console.log(
        `${current}/${works.length}`
      );
    }

    await finishJob(JOBS.RESERVE);

    console.log("予約作品更新完了");
  } catch (error) {
    console.error(
      "updateReserveWorks エラー:",
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