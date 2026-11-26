import { UPDATE_CONFIG } from "@/config/update";
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
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import {
  updateWorkWithApiPrices,
  type ApiPriceUpdateOutcome,
} from "./updateWorkWithApiPrices";

const DAY_MS = 24 * 60 * 60 * 1000;
const NORMAL_REFRESH_DAYS = 7;
const BOTTOM_PRICE_REFRESH_DAYS = 30;
const INCOMPLETE_RETRY_DELAY_MS = 15_000;
const MAX_INCOMPLETE_RETRIES_PER_RUN = 100;
const OLD_UNAVAILABLE_STATUS = /^UNAVAILABLE_[12]_[0-9]{8}_OLD$/;
const OLD_DISCONTINUED_STATUS = /^DISCONTINUED_[0-9]{8}_OLD$/;

type OldWork = {
  product_id: string;
  stage: string | null;
  updated_at: string | null;
  is_bottom_price: boolean | null;
  playwright_status: string | null;
  url: string | null;
  price: number | null;
  list_price: number | null;
};

type OldWorkUpdateFailure = { productId: string; reason: string };

function failureReason(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

async function loadAllOldWorks(): Promise<OldWork[]> {
  const works: OldWork[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select(
        "product_id, stage, updated_at, is_bottom_price, playwright_status, url, price, list_price",
      )
      .in("stage", ["OLD", "DISCONTINUED"])
      .order("product_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    works.push(...data);
    if (data.length < pageSize) break;
  }

  return works;
}

function productGroup(productId: string): number {
  const hash = [...productId].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return hash % 7;
}

function updatedAtMs(work: OldWork): number {
  if (!work.updated_at) return 0;
  const parsed = Date.parse(work.updated_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasRequiredDataMissing(work: OldWork): boolean {
  return (
    !work.url ||
    work.price == null ||
    work.list_price == null ||
    !work.playwright_status
  );
}

function isUrgent(work: OldWork): boolean {
  if (work.stage === "DISCONTINUED") return false;
  return (
    work.playwright_status === "PENDING" ||
    OLD_UNAVAILABLE_STATUS.test(work.playwright_status ?? "") ||
    hasRequiredDataMissing(work)
  );
}

function isDue(work: OldWork, todayGroup: number): boolean {
  if (isUrgent(work)) return true;
  if (productGroup(work.product_id) !== todayGroup) return false;

  const refreshDays =
    work.stage === "DISCONTINUED" || work.is_bottom_price
      ? BOTTOM_PRICE_REFRESH_DAYS
      : NORMAL_REFRESH_DAYS;

  return Date.now() - updatedAtMs(work) >= refreshDays * DAY_MS;
}

export async function updateOldWorks() {
  const allWorks = await loadAllOldWorks();
  const todayGroup = Math.floor(Date.now() / DAY_MS) % 7;

  const targets = allWorks
    .filter((work) => isDue(work, todayGroup))
    .sort((left, right) => {
      const priorityDifference = Number(isUrgent(right)) - Number(isUrgent(left));
      if (priorityDifference !== 0) return priorityDifference;

      const dateDifference = updatedAtMs(left) - updatedAtMs(right);
      if (dateDifference !== 0) return dateDifference;

      return left.product_id.localeCompare(right.product_id);
    });

  const urgentCount = targets.filter(isUrgent).length;
  const bottomPriceCount = targets.filter(
    (work) => work.is_bottom_price && !isUrgent(work),
  ).length;

  console.log(`[OLD] DB全件=${allWorks.length}`);
  console.log(
    `[OLD] 本日の対象=${targets.length} urgent=${urgentCount} bottom30days=${bottomPriceCount} group=${todayGroup}`,
  );

  if (targets.length === 0) {
    console.log("更新対象の旧作はありません");
    return { workIds: [] as string[] };
  }

  const job = await beginJob(JOBS.OLD, targets.length);
  const resumed = job.status === "running" && (job.processed_count ?? 0) > 0;

  // Updated rows disappear from the candidate set. On recovery, processing
  // every remaining candidate avoids skipping rows by slicing a changed list.
  // Progress restarts against this recovery snapshot so retries cannot push
  // processed_count past the old run's denominator.
  let current = 0;
  const totalCount = targets.length;
  let succeeded = 0;
  let updated = 0;
  let unchanged = 0;
  const updatedWorkIds: string[] = [];
  const incompleteProductIds = new Set<string>();
  const fatalFailures: OldWorkUpdateFailure[] = [];
  let browser = await createBrowser();

  console.log(
    `[OLD] 更新開始${resumed ? " (残存対象を再走査)" : ""} progress=${current}/${totalCount}`,
  );

  try {
    for (let i = 0; i < targets.length; i += UPDATE_CONFIG.parallel) {
      const batch = targets.slice(i, i + UPDATE_CONFIG.parallel);

      const results = await Promise.all(
        batch.map(async (work) => {
          try {
            const outcome: ApiPriceUpdateOutcome = await updateWorkWithApiPrices(
              work.product_id,
              browser,
              undefined,
              { logPrefix: "OLD_API_PRICE" },
            );
            if (outcome === "incomplete") {
              incompleteProductIds.add(work.product_id);
              console.error(`[OLD_UPDATE_INCOMPLETE] ${work.product_id}`);
              return false;
            }

            if (outcome === "updated") {
              updated += 1;
              updatedWorkIds.push(work.product_id);
            } else {
              unchanged += 1;
            }
            console.log(`[OLD_UPDATE_OK] ${work.product_id} outcome=${outcome}`);
            return true;
          } catch (error) {
            // updated_at remains old, so only this work is retried next time.
            fatalFailures.push({ productId: work.product_id, reason: failureReason(error) });
            console.error(`[OLD_UPDATE_ERROR] ${work.product_id}`, error);
            return false;
          }
        }),
      );

      succeeded += results.filter(Boolean).length;
      current += batch.length;

      if (current % UPDATE_CONFIG.browserRestartInterval === 0) {
        console.log(`🔄 Browser再起動 (${current}件処理)`);
        await closeBrowser(browser);
        browser = await createBrowser();
      }

      const failureExamples = [
        ...fatalFailures,
        ...[...incompleteProductIds].map((productId) => ({
          productId,
          reason: "価格更新を確認できませんでした",
        })),
      ].slice(0, 5)
        .map((failure) => `${failure.productId} (${failure.reason})`)
        .join(", ");
      const pendingCount = fatalFailures.length + incompleteProductIds.size;
      const progressMessage = `INFO: 旧作更新 ${current}/${totalCount}件。今回の処理: 更新 ${updated}件、変更なし ${unchanged}件、未確認 ${pendingCount}件${failureExamples ? `。未確認例: ${failureExamples}` : ""}`;
      await updateJob(
        JOBS.OLD,
        current,
        batch[batch.length - 1].product_id,
        progressMessage,
        totalCount,
      );
      console.log(
        `[OLD] progress=${current} success=${succeeded} unresolved=${pendingCount}`,
      );
    }

    let confirmedDiscontinuedCount = 0;
    let deferredUnavailableCount = 0;
    let needsReviewCount = 0;

    // Retry only products whose page/API returned no usable price. A short
    // pause gives transient storefront responses one bounded recovery chance.
    const retryProductIds = [...incompleteProductIds]
      .sort((left, right) => left.localeCompare(right))
      .slice(0, MAX_INCOMPLETE_RETRIES_PER_RUN);
    if (retryProductIds.length > 0) {
      console.log(
        `[OLD_FINAL_RETRY] 価格未確認の${retryProductIds.length}件だけ15秒後に再確認します（未再試行${Math.max(incompleteProductIds.size - retryProductIds.length, 0)}件）: ${retryProductIds.join(", ")}`,
      );
      await new Promise((resolve) => setTimeout(resolve, INCOMPLETE_RETRY_DELAY_MS));

      for (let index = 0; index < retryProductIds.length; index += UPDATE_CONFIG.parallel) {
        const batch = retryProductIds.slice(index, index + UPDATE_CONFIG.parallel);
        const retryResults = await Promise.all(
          batch.map(async (productId) => {
            try {
              const outcome = await updateWorkWithApiPrices(
                productId,
                browser,
                undefined,
                { logPrefix: "OLD_API_PRICE_RETRY" },
              );
              return { productId, outcome };
            } catch (error) {
              return { productId, error };
            }
          }),
        );

        for (const result of retryResults) {
          if ("error" in result) {
            console.error(`[OLD_FINAL_RETRY_ERROR] ${result.productId}`, result.error);
          } else if (result.outcome === "updated") {
            incompleteProductIds.delete(result.productId);
            updated += 1;
            succeeded += 1;
            updatedWorkIds.push(result.productId);
            console.log(`[OLD_FINAL_RETRY_OK] ${result.productId} outcome=updated`);
          } else if (result.outcome === "unchanged") {
            incompleteProductIds.delete(result.productId);
            unchanged += 1;
            succeeded += 1;
            console.log(`[OLD_FINAL_RETRY_OK] ${result.productId} outcome=unchanged`);
          }
        }
      }

      if (incompleteProductIds.size > 0) {
        const { data, error } = await supabase
          .from("works")
          .select("product_id,stage,playwright_status,url")
          .in("product_id", [...incompleteProductIds]);
        if (error) throw error;

        const statusByProductId = new Map(
          (data ?? []).map((work) => [work.product_id, work] as const),
        );
        for (const productId of [...incompleteProductIds]) {
          const work = statusByProductId.get(productId);
          if (
            work?.stage === "DISCONTINUED" &&
            OLD_DISCONTINUED_STATUS.test(work.playwright_status ?? "")
          ) {
            confirmedDiscontinuedCount += 1;
            incompleteProductIds.delete(productId);
          } else if (
            work?.stage === "OLD" &&
            OLD_UNAVAILABLE_STATUS.test(work.playwright_status ?? "")
          ) {
            deferredUnavailableCount += 1;
            incompleteProductIds.delete(productId);
          } else if (work?.url) {
            // A valid product URL remains available, but no sale state was
            // confirmed. Keep it visible as pending review without failing
            // the entire scheduled sequence.
            needsReviewCount += 1;
            incompleteProductIds.delete(productId);
          } else {
            fatalFailures.push({
              productId,
              reason: "未確認状態を保存できませんでした",
            });
            incompleteProductIds.delete(productId);
          }
        }
      }
    }

    const failureExamples = fatalFailures.slice(0, 5)
      .map((failure) => `${failure.productId} (${failure.reason})`)
      .join(", ");
    const warning = confirmedDiscontinuedCount > 0 || deferredUnavailableCount > 0 || needsReviewCount > 0
      ? `価格未確認${confirmedDiscontinuedCount + deferredUnavailableCount + needsReviewCount}件: 販売終了確認済み${confirmedDiscontinuedCount}件、別日確認中${deferredUnavailableCount}件、要再確認${needsReviewCount}件。UNAVAILABLE_1/2は次回の旧作更新で優先確認し、3日分の確認が揃うまで販売終了扱いにしません。`
      : undefined;
    const summary = `旧作更新 ${current}/${totalCount}件。更新 ${updated}件、変更なし ${unchanged}件、販売終了確認済み ${confirmedDiscontinuedCount}件、別日確認中 ${deferredUnavailableCount}件、要再確認 ${needsReviewCount}件、失敗 ${fatalFailures.length}件${warning ? `。${warning}` : ""}${failureExamples ? `。失敗例: ${failureExamples}` : ""}`;

    const pendingUnavailableCount = deferredUnavailableCount + needsReviewCount;
    // Compare against the full old-work catalog. `totalCount` is only today's
    // due/resume subset and can shrink to the unresolved tail after a retry.
    const unavailableLimit = Math.max(10, Math.ceil(allWorks.length * 0.01));
    if (pendingUnavailableCount > unavailableLimit) {
      throw new Error(
        `${summary}。価格未確認が上限${unavailableLimit}件を超えたため、広範囲の取得障害を疑って後続工程を停止しました。`,
      );
    }

    if (fatalFailures.length > 0) {
      throw new Error(`${summary}。未完了作品を確認するため、ジョブを失敗扱いにしました。`);
    }

    await finishJob(JOBS.OLD, warning ? `INFO: ${summary}` : null);
    console.log(
      `[OLD] 完了 success=${succeeded} discontinued=${confirmedDiscontinuedCount} deferred=${deferredUnavailableCount}`,
    );
    return { workIds: updatedWorkIds, warning };
  } catch (error) {
    await failJob(
      JOBS.OLD,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    await closeBrowser(browser);
  }
}

