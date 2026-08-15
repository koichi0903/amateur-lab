import { UPDATE_CONFIG } from "@/config/update";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { Browser } from "playwright-core";
import { updateWork } from "./updateWork";

type EndedSaleTarget = {
  product_id: string;
  sale_end_at: string | null;
};

async function updateBatch(batch: EndedSaleTarget[], browser: Browser) {
  return Promise.all(
    batch.map(async (work) => {
      console.log(`■ 終了セール更新開始 ${work.product_id}`);

      try {
        await updateWork(work.product_id, undefined, browser);
        console.log(`✓ 更新成功 ${work.product_id}`);
        return { productId: work.product_id, success: true as const };
      } catch (error) {
        console.error(`✗ 更新失敗 ${work.product_id}`, error);
        return { productId: work.product_id, success: false as const };
      }
    }),
  );
}

export async function updateEndedSaleWorks() {
  const now = new Date().toISOString();
  const allWorks: EndedSaleTarget[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id, sale_end_at, is_on_sale")
      .not("sale_end_at", "is", null)
      .eq("is_on_sale", true)
      .lte("sale_end_at", now)
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allWorks.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`終了日時を過ぎたセール作品 ${allWorks.length}件`);
  if (allWorks.length === 0) return;

  // 対象は毎回DBから再抽出する。古いprocessed_countではスキップしない。
  await beginJob(JOBS.ENDED_SALE, allWorks.length);

  let browser = await createBrowser();
  let processed = 0;
  let succeeded = 0;
  const failedProductIds = new Set<string>();

  try {
    for (let index = 0; index < allWorks.length; index += UPDATE_CONFIG.parallel) {
      const batch = allWorks.slice(index, index + UPDATE_CONFIG.parallel);
      const results = await updateBatch(batch, browser);

      for (const result of results) {
        if (result.success) succeeded += 1;
        else failedProductIds.add(result.productId);
      }

      processed += batch.length;
      await updateJob(
        JOBS.ENDED_SALE,
        processed,
        batch.at(-1)?.product_id ?? "",
      );

      if (processed % UPDATE_CONFIG.browserRestartInterval === 0) {
        await closeBrowser(browser);
        browser = await createBrowser();
      }

      console.log(
        `${processed}/${allWorks.length} success=${succeeded} failed=${failedProductIds.size}`,
      );
    }

    if (failedProductIds.size > 0) {
      console.log(`失敗した${failedProductIds.size}件を再試行します`);
      await closeBrowser(browser);
      browser = await createBrowser();

      const retryTargets = allWorks.filter((work) =>
        failedProductIds.has(work.product_id),
      );

      for (let index = 0; index < retryTargets.length; index += UPDATE_CONFIG.parallel) {
        const batch = retryTargets.slice(index, index + UPDATE_CONFIG.parallel);
        const results = await updateBatch(batch, browser);

        for (const result of results) {
          if (result.success) failedProductIds.delete(result.productId);
        }
      }
    }

    if (failedProductIds.size > 0) {
      const failedIds = [...failedProductIds];
      throw new Error(
        `終了セール更新に失敗した作品が${failedIds.length}件残りました: ${failedIds.join(", ")}`,
      );
    }

    await finishJob(JOBS.ENDED_SALE);
    console.log(`終了セール更新完了: ${allWorks.length}件`);
  } catch (error) {
    await failJob(
      JOBS.ENDED_SALE,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    await closeBrowser(browser);
  }
}
