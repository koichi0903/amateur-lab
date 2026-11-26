import type { Browser } from "playwright-core";

import { UPDATE_CONFIG } from "@/config/update";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
import {
  beginJob,
  failJob,
  finishJob,
  JOBS,
  updateJob,
} from "@/lib/jobs";
import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";
import { getNewItems } from "@/lib/playwright/getNewItems";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { saveDmmItem } from "./save";
import { restoreDiscontinuedWorks } from "./restoreDiscontinuedWorks";
import { updateWorkWithApiPrices } from "./updateWorkWithApiPrices";
import { notifySeriesAlertsForProducts } from "@/lib/pushNotifications";
import { shouldCaptureSampleMovie } from "./sampleMovieCapture";
import { shouldSkipUnchangedNewWorkUpdate } from "./newWorkUpdatePolicy";

type NewProduct = Awaited<ReturnType<typeof getNewItems>>["products"][number];

type NewWork = {
  product_id: string;
  release_date: string;
  list_price: number | null;
  sale_price: number | null;
  playwright_status: string | null;
  sample_movie_url: string | null;
  sample_movie_checked_at: string | null;
};

type NewWorkUpdateOutcome = "updated" | "unchanged" | "incomplete";
type NewWorkUpdateFailure = { productId: string; reason: string };

export class NewWorkPartialUpdateError extends Error {
  constructor(message: string, public readonly workIds: string[]) {
    super(message);
    this.name = "NewWorkPartialUpdateError";
  }
}

function formatNewWorkProgressMessage(input: {
  processed: number;
  total: number;
  updated: number;
  unchanged: number;
  skipped: number;
  unresolved: number;
  examples: string[];
  priorResultsUnknown: boolean;
}) {
  const { processed, total, updated, unchanged, skipped, unresolved, examples, priorResultsUnknown } = input;
  const exampleText = examples.length > 0 ? `。未完了例: ${examples.slice(0, 5).join(", ")}` : "";
  const priorText = priorResultsUnknown ? "。再開前に処理済みの結果記録がありません" : "";
  return `INFO: 新作更新 ${processed}/${total}件。今回の区間: 更新 ${updated}件、変更なし ${unchanged}件、更新不要/対象外 ${skipped}件、失敗/未確認 ${unresolved}件（登録工程を含む）${exampleText}${priorText}`;
}

function readPersistedNewWorkProgress(message: string | null | undefined) {
  if (!message?.startsWith("INFO: 新作更新 ")) return null;
  const counts = message.match(/失敗\/未確認\s+(\d+)件/);
  if (!counts) return null;
  const examples = message.match(/未完了例: ([^。]+)/)?.[1]
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
  return { unresolved: Number(counts[1]), examples };
}

async function loadAllProductIds(): Promise<Set<string>> {
  const productIds = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
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
    from += pageSize;
  }

  return productIds;
}

async function loadNewWorks(): Promise<NewWork[]> {
  const works: NewWork[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "product_id, release_date, list_price, sale_price, playwright_status, sample_movie_url, sample_movie_checked_at",
      )
      .eq("stage", "NEW")
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    works.push(...data);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return works;
}

async function registerMissingNewWorks(
  products: NewProduct[],
  browser: Browser,
): Promise<NewWorkUpdateFailure[]> {
  const existingIds = await loadAllProductIds();
  const missingProducts = products.filter(
    (product) => !existingIds.has(product.productId),
  );
  const failures: NewWorkUpdateFailure[] = [];

  if (missingProducts.length === 0) {
    console.log("[NEW_REGISTER] 未登録作品はありません");
    return failures;
  }

  console.log(`[NEW_REGISTER] 未登録${missingProducts.length}件を登録します`);

  for (let i = 0; i < missingProducts.length; i += UPDATE_CONFIG.parallel) {
    const batch = missingProducts.slice(i, i + UPDATE_CONFIG.parallel);

    await Promise.all(
      batch.map(async (product) => {
        try {
          const item = await getDmmItem(product.productId);

          if (!item) {
            failures.push({ productId: product.productId, reason: "DMM APIから作品情報を取得できませんでした" });
            console.warn(`[NEW_REGISTER_SKIP] DMM API未取得 ${product.productId}`);
            return;
          }

          const saved = await saveDmmItem(item, undefined, "NEW");

          if (!saved) {
            failures.push({ productId: product.productId, reason: "DB登録結果を確認できませんでした" });
            console.warn(
              `[NEW_REGISTER_SKIP] DB登録失敗または登録済み ${product.productId}`,
            );
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
            console.log(`[NEW_REGISTER_OK] ${product.productId}`);
          } catch (error) {
            // The row remains PENDING; the regular update pass below retries its
            // prices and sample movie within this same run.
            console.error(
              `[NEW_REGISTER_PLAYWRIGHT_ERROR] ${product.productId}`,
              error,
            );
          }
        } catch (error) {
          failures.push({
            productId: product.productId,
            reason: error instanceof Error ? error.name : "UnknownError",
          });
          console.error(
            `[NEW_REGISTER_ERROR] ${product.productId}`,
            error,
          );
        }
      }),
    );

    console.log(
      `[NEW_REGISTER] ${Math.min(i + batch.length, missingProducts.length)}/${missingProducts.length}`,
    );
  }

  return failures;
}

async function updateRegisteredNewWork(
  productId: string,
  browser: Browser,
  listPrice: number | null,
  captureSampleMovie: boolean,
): Promise<NewWorkUpdateOutcome> {
  return updateWorkWithApiPrices(productId, browser, listPrice, {
    captureSampleMovie,
    logPrefix: "NEW_API_PRICE",
  });
}

export async function updateNewWorks() {
  const updatedWorkIds: string[] = [];
  const { products } = await getNewItems();
  const productMap = new Map(
    products.map((product) => [product.productId, product]),
  );

  let browser = await createBrowser();
  let jobStarted = false;

  try {
    await restoreDiscontinuedWorks(
      products.map((product) => product.productId),
      "NEW",
    );

    // Restore the original new-work sync: register missing FANZA products via
    // DMM API, then use Playwright once to capture every price variation.
    const registrationFailures = await registerMissingNewWorks(products, browser);

    // Start the regular update pass with a fresh browser after registration.
    await closeBrowser(browser);
    browser = await createBrowser();

    const works = await loadNewWorks();

    if (works.length === 0) {
      console.log("更新対象の新作はありません");
      if (registrationFailures.length > 0) {
        await beginJob(JOBS.NEW_UPDATE, registrationFailures.length);
        jobStarted = true;
        const examples = registrationFailures.map((failure) => `${failure.productId} (${failure.reason})`);
        const message = formatNewWorkProgressMessage({
          processed: registrationFailures.length,
          total: registrationFailures.length,
          updated: 0,
          unchanged: 0,
          skipped: 0,
          unresolved: registrationFailures.length,
          examples,
          priorResultsUnknown: false,
        });
        await updateJob(
          JOBS.NEW_UPDATE,
          registrationFailures.length,
          registrationFailures.at(-1)!.productId,
          message,
        );
        throw new NewWorkPartialUpdateError(
          `${message.replace(/^INFO: /, "")}。登録に失敗した作品を確認してください。`,
          registrationFailures.map((failure) => failure.productId),
        );
      }
      return { workIds: updatedWorkIds };
    }

    const job = await beginJob(JOBS.NEW_UPDATE, works.length);
    jobStarted = true;

    const processedCount = job.processed_count ?? 0;
    const targets = works.slice(processedCount);
    let current = processedCount;
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    const newWorkIds = new Set(works.map((work) => work.product_id));
    const failures: NewWorkUpdateFailure[] = registrationFailures.filter(
      (failure) => !newWorkIds.has(failure.productId),
    );
    const resumedWithProgress = job.status === "running" && processedCount > 0;
    const persistedProgress = resumedWithProgress
      ? readPersistedNewWorkProgress(job.error_message)
      : null;
    const priorResultsUnknown = resumedWithProgress && !persistedProgress;
    const priorUnresolvedCount = persistedProgress?.unresolved ?? (priorResultsUnknown ? processedCount : 0);
    const priorFailureExamples = persistedProgress?.examples ?? [];

    console.log(
      `新作更新開始 (${processedCount}/${works.length}から再開)`,
    );

    for (let i = 0; i < targets.length; i += UPDATE_CONFIG.parallel) {
      const batch = targets.slice(i, i + UPDATE_CONFIG.parallel);

      await Promise.all(
        batch.map(async (work) => {
          const latest = productMap.get(work.product_id);

          if (!latest) {
            try {
              const { error } = await supabase
                .from("works")
                .update({ stage: "SEMI_NEW" })
                .eq("product_id", work.product_id);

              if (error) throw error;

              updatedWorkIds.push(work.product_id);
              skippedCount += 1;
              console.log(`[STAGE] ${work.product_id} NEW → SEMI_NEW`);
            } catch (error) {
              failures.push({
                productId: work.product_id,
                reason: error instanceof Error ? error.name : "UnknownError",
              });
              console.error(`[ERROR] stage移行失敗 ${work.product_id}`, error);
            }
            return;
          }

          const dbPrice = work.sale_price ?? work.list_price;
          const latestPrice = latest.salePrice ?? latest.listPrice;
          const captureSampleMovie = shouldCaptureSampleMovie({
            stage: "NEW",
            sampleMovieUrl: work.sample_movie_url,
            sampleMovieCheckedAt: work.sample_movie_checked_at,
          });

          // PENDING means initial Playwright completion is still required even
          // when the headline price already matches the listing page.
          if (shouldSkipUnchangedNewWorkUpdate({
            playwrightStatus: work.playwright_status,
            databasePrice: dbPrice,
            latestPrice,
            captureSampleMovie,
          })) {
            skippedCount += 1;
            console.log(`[SKIP] ${work.product_id} price=${dbPrice}`);
            return;
          }

          console.log(
            `[UPDATE] ${work.product_id} ${dbPrice} → ${latestPrice}`,
          );

          try {
            const outcome = await updateRegisteredNewWork(
              work.product_id,
              browser,
              latest.listPrice,
              captureSampleMovie,
            );
            if (outcome === "updated") {
              updatedCount += 1;
              updatedWorkIds.push(work.product_id);
            } else if (outcome === "unchanged") {
              unchangedCount += 1;
            } else {
              failures.push({ productId: work.product_id, reason: "価格更新を確認できませんでした" });
              console.error(`[ERROR] update未完了 ${work.product_id}: Playwright/API結果が未確定`);
            }
          } catch (error) {
            failures.push({
              productId: work.product_id,
              reason: error instanceof Error ? error.name : "UnknownError",
            });
            console.error(`[ERROR] update失敗 ${work.product_id}`, error);
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
      const currentExamples = [
        ...priorFailureExamples,
        ...failures.map((failure) => `${failure.productId} (${failure.reason})`),
      ];
      await updateJob(
        JOBS.NEW_UPDATE,
        current,
        lastWork.product_id,
        formatNewWorkProgressMessage({
          processed: current,
          total: works.length,
          updated: updatedCount,
          unchanged: unchangedCount,
          skipped: skippedCount,
          unresolved: priorUnresolvedCount + failures.length,
          examples: [...new Set(currentExamples)],
          priorResultsUnknown,
        }),
      );

      console.log(`${current}/${works.length}`);
    }

    const unresolvedCount = priorUnresolvedCount + failures.length;
    const failureExamples = [...new Set([
      ...priorFailureExamples,
      ...failures.map((failure) => `${failure.productId} (${failure.reason})`),
    ])];
    const resultSummary = formatNewWorkProgressMessage({
      processed: works.length,
      total: works.length,
      updated: updatedCount,
      unchanged: unchangedCount,
      skipped: skippedCount,
      unresolved: unresolvedCount,
      examples: failureExamples,
      priorResultsUnknown,
    });

    if (unresolvedCount > 0 || priorResultsUnknown) {
      const unresolvedIds = failures.map((failure) => failure.productId);
      const workIds = [...new Set([...updatedWorkIds, ...unresolvedIds])];
      throw new NewWorkPartialUpdateError(
        priorResultsUnknown
          ? `${resultSummary.replace(/^INFO: /, "")}。再開前に処理済みだった${processedCount}件の個別結果を確認できないため、全件成功とは判定できません。先頭から再実行してください。`
          : `${resultSummary.replace(/^INFO: /, "")}。未完了作品を確認するため、ジョブを失敗扱いにしました。`,
        workIds,
      );
    }

    await finishJob(JOBS.NEW_UPDATE, resultSummary);
    try {
      await notifySeriesAlertsForProducts(updatedWorkIds);
    } catch (notificationError) {
      console.error("[push] series notifications failed", notificationError);
    }
    console.log("新作更新完了");
    return { workIds: updatedWorkIds };
  } catch (error) {
    console.error("updateNewWorks エラー:", error);

    if (jobStarted) {
      await failJob(
        JOBS.NEW_UPDATE,
        error instanceof Error ? error.message : String(error),
      );
    }

    throw error;
  } finally {
    await closeBrowser(browser);
  }
}
