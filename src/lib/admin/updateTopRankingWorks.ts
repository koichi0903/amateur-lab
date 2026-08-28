import type { Browser } from "playwright-core";

import { RANKING_UPDATE_CONFIG, UPDATE_CONFIG } from "@/config/update";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";

import type { RankingPlaywrightTarget } from "./rankingPlaywrightTargets";
import { updateWork } from "./updateWork";

async function updateBatch(
  targets: RankingPlaywrightTarget[],
  browser: Browser,
): Promise<RankingPlaywrightTarget[]> {
  const results = await Promise.allSettled(
    targets.map(({ item, listPrice, captureSampleMovie }) =>
      updateWork(
        item.content_id,
        item,
        browser,
        listPrice ?? undefined,
        { captureSampleMovie },
      ),
    ),
  );

  return targets.filter((target, index) => {
    const result = results[index];
    if (result.status === "rejected") {
      console.error("[ranking-playwright] 更新失敗", {
        productId: target.item.content_id,
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

type RankingPlaywrightProgress = (
  processed: number,
  total: number,
  productId: string,
) => Promise<void>;

export async function updateTopRankingWorks(
  rankingTargets: RankingPlaywrightTarget[],
  onProgress?: RankingPlaywrightProgress,
) {
  let browser: Browser | null = null;

  try {
    const targets = rankingTargets.slice(0, RANKING_UPDATE_CONFIG.targetCount);
    let processed = 0;

    console.log(`[ranking-playwright] 詳細更新対象${targets.length}件`);

    if (targets.length === 0) return;

    browser = await createBrowser();
    const batchSize = UPDATE_CONFIG.parallel;

    for (let index = 0; index < targets.length; index += batchSize) {
      const batch = targets.slice(index, index + batchSize);
      for (const target of batch) {
        console.log(
          `[ranking-playwright] ${target.item.content_id} reasons=${target.reasons.join(",")}`,
        );
      }

      let failedTargets = await updateBatch(batch, browser);

      if (failedTargets.length > 0) {
        console.warn(
          `[ranking-playwright] ${failedTargets.length}件をブラウザ再起動後に再試行します`,
        );
        await closeBrowser(browser);
        browser = await createBrowser();
        failedTargets = await updateBatch(failedTargets, browser);
      }

      if (failedTargets.length > 0) {
        throw new Error(
          `Playwright更新に失敗しました: ${failedTargets
            .map(({ item }) => item.content_id)
            .join(", ")}`,
        );
      }

      processed += batch.length;
      await onProgress?.(
        processed,
        targets.length,
        batch[batch.length - 1].item.content_id,
      );

      console.log(`[ranking-playwright] ${processed}/${targets.length}`);

      if (
        processed < targets.length &&
        processed % UPDATE_CONFIG.browserRestartInterval === 0
      ) {
        await closeBrowser(browser);
        browser = await createBrowser();
      }
    }
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
