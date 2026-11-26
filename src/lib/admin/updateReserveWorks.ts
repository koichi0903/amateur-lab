import type { Browser } from "playwright-core";

import { UPDATE_CONFIG } from "@/config/update";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import {
  beginJob,
  failJob,
  finishJob,
  JOBS,
  updateJob,
  updateJobProgress,
} from "@/lib/jobs";
import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";
import { getReserveItems } from "@/lib/playwright/getReserveItems";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { saveDmmItem } from "./save";
import { restoreDiscontinuedWorks } from "./restoreDiscontinuedWorks";
import { updateWorkWithApiPrices } from "./updateWorkWithApiPrices";

type ReserveProduct = Awaited<
  ReturnType<typeof getReserveItems>
>["products"][number];

type ReservedWork = {
  product_id: string;
};

type ReserveUpdateFailure = { productId: string; reason: string };

export class ReservePartialUpdateError extends Error {
  constructor(message: string, public readonly workIds: string[]) {
    super(message);
    this.name = "ReservePartialUpdateError";
  }
}

function errorReason(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  return error.message.slice(0, 160) || error.name;
}

function formatReserveProgressMessage(input: {
  processed: number;
  total: number;
  updated: number;
  unchanged: number;
  failures: ReserveUpdateFailure[];
}) {
  const examples = [...new Set(
    input.failures.map(({ productId, reason }) => `${productId} (${reason})`),
  )].slice(0, 5);
  const exampleText = examples.length > 0 ? `。未完了例: ${examples.join(", ")}` : "";
  return `INFO: 予約作品更新 ${input.processed}/${input.total}件。更新 ${input.updated}件、変更なし ${input.unchanged}件、失敗/未確認 ${input.failures.length}件${exampleText}`;
}

async function loadAllProductIds(): Promise<Set<string>> {
  const productIds = new Set<string>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id")
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    for (const work of data ?? []) {
      if (work.product_id) productIds.add(work.product_id);
    }

    if (!data || data.length < pageSize) break;
  }

  return productIds;
}

async function loadReservedWorks(): Promise<ReservedWork[]> {
  const works: ReservedWork[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id")
      .eq("stage", "RESERVED")
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    works.push(...data);
    if (data.length < pageSize) break;
  }

  return works;
}

async function registerMissingReservedWorks(
  products: ReserveProduct[],
  browser: Browser,
  onProgress?: (
    processed: number,
    total: number,
    productId?: string,
  ) => Promise<void>,
): Promise<ReserveUpdateFailure[]> {
  const existingIds = await loadAllProductIds();
  const missingProducts = products.filter(
    (product) => !existingIds.has(product.productId),
  );

  if (missingProducts.length === 0) {
    console.log("[RESERVE_REGISTER] 未登録作品はありません");
    await onProgress?.(0, 0);
    return [];
  }

  const failures: ReserveUpdateFailure[] = [];

  console.log(
    `[RESERVE_REGISTER] 未登録${missingProducts.length}件を登録します`,
  );

  for (let i = 0; i < missingProducts.length; i += UPDATE_CONFIG.parallel) {
    const batch = missingProducts.slice(i, i + UPDATE_CONFIG.parallel);

    await Promise.all(
      batch.map(async (product) => {
        try {
          const item = await getDmmItem(product.productId);

          if (!item) {
            failures.push({
              productId: product.productId,
              reason: "DMM APIから作品情報を取得できませんでした",
            });
            console.warn(
              `[RESERVE_REGISTER_SKIP] DMM API未取得 ${product.productId}`,
            );
            return;
          }

          const saved = await saveDmmItem(item, undefined, "RESERVED");
          if (!saved) {
            failures.push({
              productId: product.productId,
              reason: "DB登録結果を確認できませんでした",
            });
            return;
          }

          try {
            await updatePlaywrightItem(
              product.productId,
              item.URL ?? item.affiliateURL,
              browser,
              product.listPrice,
              { captureSampleMovie: true },
            );
          } catch (error) {
            // The regular API price pass below still retries this saved work.
            console.error(
              `[RESERVE_REGISTER_PLAYWRIGHT_ERROR] ${product.productId}`,
              error,
            );
          }

          console.log(`[RESERVE_REGISTER_OK] ${product.productId}`);
        } catch (error) {
          // The row remains PENDING. A later normal pass can complete pricing,
          // but sample movie discovery is intentionally limited to this insert.
          failures.push({
            productId: product.productId,
            reason: errorReason(error),
          });
          console.error(
            `[RESERVE_REGISTER_ERROR] ${product.productId}`,
            error,
          );
        }
      }),
    );

    const processed = Math.min(i + batch.length, missingProducts.length);
    await onProgress?.(
      processed,
      missingProducts.length,
      batch.at(-1)?.productId,
    );
  }

  return failures;
}

export async function updateReserveWorks() {
  const updatedWorkIds: string[] = [];
  let browser: Browser | null = null;
  let jobStarted = false;

  try {
    const job = await beginJob(JOBS.RESERVE, 0);
    jobStarted = true;
    const previousProcessedCount = job.processed_count ?? 0;
    // Earlier reserve runs advanced processed_count even when a work failed.
    // Rescan the full list after an interrupted run so such failures cannot be
    // skipped when this job resumes.
    const resumeProcessedCount = 0;
    if (previousProcessedCount > 0) {
      console.warn(
        `[RESERVE_RESUME_RESCAN] previous progress=${previousProcessedCount}; restarting work scan from 0/${job.total_count ?? 0}`,
      );
    }
    await updateJobProgress(JOBS.RESERVE, {
      processedCount: resumeProcessedCount,
      totalCount: job.total_count ?? 0,
      detail: { phase: "reserve_listing" },
    });

    const { products, totalPages } = await getReserveItems();

    // An empty scrape must never demote every RESERVED row to NEW.
    if (products.length === 0) {
      throw new Error(
        `予約作品一覧を取得できませんでした（検出ページ数: ${totalPages}）`,
      );
    }

    const productMap = new Map(
      products.map((product) => [product.productId, product]),
    );

    browser = await createBrowser();
    await restoreDiscontinuedWorks(
      products.map((product) => product.productId),
      "RESERVED",
    );

    await updateJobProgress(JOBS.RESERVE, {
      processedCount: resumeProcessedCount,
      totalCount: products.length,
      detail: {
        phase: "reserve_register",
        current: 0,
        total: products.length,
      },
    });
    const registrationFailures = await registerMissingReservedWorks(
      products,
      browser,
      async (processed, total, productId) => {
        await updateJobProgress(JOBS.RESERVE, {
          processedCount: resumeProcessedCount,
          totalCount: products.length,
          detail: {
            phase: "reserve_register",
            current: processed,
            total,
            productId,
          },
        });
      },
    );

    // Registration and the regular pass use separate browser lifetimes.
    await closeBrowser(browser);
    browser = await createBrowser();

    const works = await loadReservedWorks();
    if (works.length === 0) {
      console.log("更新対象の予約作品はありません");
      if (registrationFailures.length > 0) {
        const message = formatReserveProgressMessage({
          processed: 0,
          total: registrationFailures.length,
          updated: 0,
          unchanged: 0,
          failures: registrationFailures,
        });
        throw new ReservePartialUpdateError(
          `${message.replace(/^INFO: /, "")}。未登録作品を確認するため、ジョブを失敗扱いにしました。`,
          registrationFailures.map(({ productId }) => productId),
        );
      }
      await finishJob(JOBS.RESERVE);
      return { workIds: updatedWorkIds };
    }

    const processedCount = Math.min(resumeProcessedCount, works.length);
    const targets = works.slice(processedCount);
    let current = processedCount;

    await updateJobProgress(JOBS.RESERVE, {
      processedCount,
      totalCount: works.length,
      detail: {
        phase: "reserve_update",
        current: processedCount,
        total: works.length,
      },
    });

    console.log(
      `予約作品更新開始 (${processedCount}/${works.length}から再開)`,
    );

    const reservedIds = new Set(works.map(({ product_id }) => product_id));
    const failures = registrationFailures.filter(
      ({ productId }) => !reservedIds.has(productId),
    );
    let updatedCount = 0;
    let unchangedCount = 0;

    for (let i = 0; i < targets.length; i += UPDATE_CONFIG.parallel) {
      const batch = targets.slice(i, i + UPDATE_CONFIG.parallel);
      const batchBrowser = browser;
      if (!batchBrowser) throw new Error("予約作品更新ブラウザが利用できません");

      await Promise.all(
        batch.map(async (work) => {
          const latest = productMap.get(work.product_id);

          try {
            // Always refresh DMM details while a product is reserved. The
            // release date can move even when the headline price is unchanged.
            const outcome = await updateWorkWithApiPrices(
              work.product_id,
              batchBrowser,
              latest?.listPrice ?? null,
              {
                logPrefix: "RESERVE_API_PRICE",
                // A RESERVED work that leaves the reservation listing is being
                // promoted to NEW below. Recheck the sample movie even when the
                // reservation-time check already recorded checked_at.
                captureSampleMovie: !latest,
              },
            );
            if (outcome === "updated") {
              updatedCount += 1;
              updatedWorkIds.push(work.product_id);
            } else if (outcome === "unchanged") {
              unchangedCount += 1;
            } else {
              failures.push({
                productId: work.product_id,
                reason: "価格更新を確認できませんでした",
              });
              console.error(
                `[RESERVE_UPDATE_INCOMPLETE] ${work.product_id}: API/Playwright結果が未確定`,
              );
              return;
            }

            if (!latest) {
              const { error } = await supabase
                .from("works")
                .update({ stage: "NEW" })
                .eq("product_id", work.product_id);

              if (error) throw error;

              if (outcome !== "updated") updatedWorkIds.push(work.product_id);

              console.log(`[STAGE] ${work.product_id} RESERVED → NEW`);
            } else {
              console.log(`[RESERVE_UPDATE_OK] ${work.product_id}`);
            }
          } catch (error) {
            console.error(`[RESERVE_UPDATE_ERROR] ${work.product_id}`, error);
            failures.push({
              productId: work.product_id,
              reason: errorReason(error),
            });
          }
        }),
      );

      current += batch.length;

      if (current % UPDATE_CONFIG.browserRestartInterval === 0) {
        console.log(`🔄 Browser再起動 (${current}件処理)`);
        await closeBrowser(browser);
        browser = await createBrowser();
      }

      const lastWork = batch[batch.length - 1];
      const message = formatReserveProgressMessage({
        processed: current,
        total: works.length,
        updated: updatedCount,
        unchanged: unchangedCount,
        failures,
      });
      await updateJob(JOBS.RESERVE, current, lastWork.product_id, message);
      await updateJobProgress(JOBS.RESERVE, {
        processedCount: current,
        totalCount: works.length,
        detail: {
          phase: "reserve_update",
          current,
          total: works.length,
          productId: lastWork.product_id,
        },
      });
      console.log(`${current}/${works.length}`);
    }

    if (failures.length > 0) {
      const message = formatReserveProgressMessage({
        processed: works.length,
        total: works.length,
        updated: updatedCount,
        unchanged: unchangedCount,
        failures,
      });
      throw new ReservePartialUpdateError(
        `${message.replace(/^INFO: /, "")}。未完了作品を確認するため、ジョブを失敗扱いにしました。`,
        failures.map(({ productId }) => productId),
      );
    }

    await finishJob(
      JOBS.RESERVE,
      formatReserveProgressMessage({
        processed: works.length,
        total: works.length,
        updated: updatedCount,
        unchanged: unchangedCount,
        failures: [],
      }),
    );
    console.log("予約作品更新完了");
    return { workIds: updatedWorkIds };
  } catch (error) {
    console.error("updateReserveWorks エラー:", error);

    if (jobStarted) {
      await failJob(
        JOBS.RESERVE,
        error instanceof Error ? error.message : String(error),
      );
    }

    throw error;
  } finally {
    if (browser) await closeBrowser(browser);
  }
}


