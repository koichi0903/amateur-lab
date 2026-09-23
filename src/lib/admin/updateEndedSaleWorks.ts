import { UPDATE_CONFIG } from "@/config/update";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { Browser } from "playwright-core";
import { updateWork } from "./updateWork";
import {
  ENDED_SALE_MAX_TARGETS_PER_RUN,
  selectEndedSaleBatch,
} from "./endedSaleBatch";

type EndedSaleTarget = {
  product_id: string;
  sale_end_at: string | null;
};

async function updateBatch(batch: EndedSaleTarget[], browser: Browser) {
  return Promise.all(
    batch.map(async (work) => {
      console.log(`■ 終了セール更新開始 ${work.product_id}`);

      try {
        const changed = await updateWork(work.product_id, undefined, browser);
        console.log(`✓ 更新成功 ${work.product_id}`);
        return { productId: work.product_id, success: true as const, changed };
      } catch (error) {
        console.error(`✗ 更新失敗 ${work.product_id}`, error);
        return { productId: work.product_id, success: false as const };
      }
    }),
  );
}

export async function updateEndedSaleWorks() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("works")
    .select("product_id, sale_end_at, is_on_sale")
    .not("sale_end_at", "is", null)
    .eq("is_on_sale", true)
    .lte("sale_end_at", now)
    .order("sale_end_at")
    .order("product_id")
    .limit(ENDED_SALE_MAX_TARGETS_PER_RUN + 1);

  if (error) throw error;

  const selection = selectEndedSaleBatch((data ?? []) as EndedSaleTarget[]);
  const allWorks = selection.batch;
  console.log(
    `終了日時を過ぎたセール作品 ${allWorks.length}件` +
      (selection.hasMore
        ? `（次回へ継続。1回上限${ENDED_SALE_MAX_TARGETS_PER_RUN}件）`
        : ""),
  );
  if (allWorks.length === 0) return { workIds: [] as string[] };

  // 対象は毎回DBから再抽出する。古いprocessed_countではスキップしない。
  await beginJob(JOBS.ENDED_SALE, allWorks.length);

  let browser = await createBrowser();
  let processed = 0;
  let succeeded = 0;
  const failedProductIds = new Set<string>();
  const updatedWorkIds = new Set<string>();

  try {
    for (let index = 0; index < allWorks.length; index += UPDATE_CONFIG.parallel) {
      const batch = allWorks.slice(index, index + UPDATE_CONFIG.parallel);
      const results = await updateBatch(batch, browser);

      for (const result of results) {
        if (result.success) succeeded += 1;
        else failedProductIds.add(result.productId);
        if (result.success && result.changed) updatedWorkIds.add(result.productId);
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
          if (result.success && result.changed) updatedWorkIds.add(result.productId);
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
    return { workIds: [...updatedWorkIds] };
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
