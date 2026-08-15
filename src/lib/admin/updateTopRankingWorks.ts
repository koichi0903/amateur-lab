import type { Browser } from "playwright-core";
import type { DmmItem } from "@/types/dmm";
import { updateWork } from "./updateWork";
import { UPDATE_CONFIG } from "@/config/update";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";
import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

const PLAYWRIGHT_LIMIT = 1000;

async function updateBatch(
  items: DmmItem[],
  browser: Browser
): Promise<DmmItem[]> {
  const results = await Promise.allSettled(
    items.map((item) => updateWork(item.content_id, item, browser))
  );

  return items.filter((_, index) => {
    const result = results[index];
    if (result.status === "rejected") {
      console.error("[ranking-playwright] 更新失敗", {
        productId: items[index].content_id,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
      return true;
    }
    return false;
  });
}

export async function updateTopRankingWorks(rankingItems: DmmItem[]) {
  let browser: Browser | null = null;

  try {
    const rankingTargets = rankingItems.slice(0, PLAYWRIGHT_LIMIT);
    const job = await beginJob(JOBS.RANKING, rankingTargets.length);
    let processed = Math.min(job.processed_count ?? 0, rankingTargets.length);
    const targets = rankingTargets.slice(processed);

    console.log(
      `[ranking-playwright] 対象${rankingTargets.length}件、再開位置${processed}件`
    );

    if (targets.length === 0) {
      await finishJob(JOBS.RANKING);
      return;
    }

    browser = await createBrowser();
    const batchSize = UPDATE_CONFIG.parallel;

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      let failedItems = await updateBatch(batch, browser);

      if (failedItems.length > 0) {
        console.warn(
          `[ranking-playwright] ${failedItems.length}件をブラウザ再起動後に再試行します`
        );
        await closeBrowser(browser);
        browser = await createBrowser();
        failedItems = await updateBatch(failedItems, browser);
      }

      if (failedItems.length > 0) {
        throw new Error(
          `Playwright更新に失敗しました: ${failedItems
            .map((item) => item.content_id)
            .join(", ")}`
        );
      }

      processed += batch.length;
      await updateJob(
        JOBS.RANKING,
        processed,
        batch[batch.length - 1].content_id
      );

      console.log(`[ranking-playwright] ${processed}/${rankingTargets.length}`);

      if (
        processed < rankingTargets.length &&
        processed % UPDATE_CONFIG.browserRestartInterval === 0
      ) {
        await closeBrowser(browser);
        browser = await createBrowser();
      }
    }

    await finishJob(JOBS.RANKING);
  } catch (error) {
    await failJob(
      JOBS.RANKING,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
