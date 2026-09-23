export const ENDED_SALE_MAX_TARGETS_PER_RUN = 1000;
export const ENDED_SALE_RUN_TIME_BUDGET_MS = 4 * 60 * 60 * 1000;

export type EndedSaleCursorTarget = {
  product_id: string;
};

export function selectEndedSaleBatch<T>(targets: T[]): {
  batch: T[];
  hasMore: boolean;
} {
  const batch = targets.slice(0, ENDED_SALE_MAX_TARGETS_PER_RUN);
  return { batch, hasMore: targets.length > batch.length };
}

/**
 * Walks a changing target set without relying on PostgREST returning more
 * than its configured 1,000-row maximum. The loader must apply the cursor
 * (`product_id > afterProductId`) and return rows in product_id order.
 */
export async function processEndedSaleBatches<
  T extends EndedSaleCursorTarget,
>(
  loadPage: (afterProductId: string | null) => Promise<T[]>,
  processPage: (page: T[]) => Promise<void>,
  options: {
    now?: () => number;
    timeBudgetMs?: number;
  } = {},
): Promise<{ processedCount: number; lastProductId: string | null }> {
  const now = options.now ?? Date.now;
  const timeBudgetMs = options.timeBudgetMs ?? ENDED_SALE_RUN_TIME_BUDGET_MS;
  const startedAt = now();
  let afterProductId: string | null = null;
  let processedCount = 0;

  while (true) {
    if (now() - startedAt >= timeBudgetMs) {
      throw new Error("終了セール更新が実行時間上限に達しました");
    }

    const page = await loadPage(afterProductId);
    if (page.length === 0) {
      return { processedCount, lastProductId: afterProductId };
    }

    const nextProductId = page.at(-1)?.product_id;
    if (!nextProductId || (afterProductId !== null && nextProductId <= afterProductId)) {
      throw new Error("終了セール更新のページングカーソルが進みませんでした");
    }

    await processPage(page);
    processedCount += page.length;
    afterProductId = nextProductId;
  }
}
