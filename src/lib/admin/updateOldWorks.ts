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

import { updateWork } from "./updateWork";

const DAY_MS = 24 * 60 * 60 * 1000;
const NORMAL_REFRESH_DAYS = 7;
const BOTTOM_PRICE_REFRESH_DAYS = 30;

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
  return work.playwright_status === "PENDING" || hasRequiredDataMissing(work);
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
    return;
  }

  const job = await beginJob(JOBS.OLD, targets.length);
  const resumedCount = job.status === "running" ? job.processed_count ?? 0 : 0;

  // Updated rows disappear from the candidate set. On recovery, processing
  // every remaining candidate avoids skipping rows by slicing a changed list.
  let current = resumedCount;
  let succeeded = 0;
  let failed = 0;
  let browser = await createBrowser();

  console.log(
    `[OLD] 更新開始 progress=${current} remaining=${targets.length}`,
  );

  try {
    for (let i = 0; i < targets.length; i += UPDATE_CONFIG.parallel) {
      const batch = targets.slice(i, i + UPDATE_CONFIG.parallel);

      const results = await Promise.all(
        batch.map(async (work) => {
          try {
            await updateWork(work.product_id, undefined, browser);
            console.log(`[OLD_UPDATE_OK] ${work.product_id}`);
            return true;
          } catch (error) {
            // updated_at remains old, so only this work is retried next time.
            console.error(`[OLD_UPDATE_ERROR] ${work.product_id}`, error);
            return false;
          }
        }),
      );

      succeeded += results.filter(Boolean).length;
      failed += results.filter((result) => !result).length;
      current += batch.length;

      if (current % UPDATE_CONFIG.browserRestartInterval === 0) {
        console.log(`🔄 Browser再起動 (${current}件処理)`);
        await closeBrowser(browser);
        browser = await createBrowser();
      }

      await updateJob(JOBS.OLD, current, batch[batch.length - 1].product_id);
      console.log(
        `[OLD] progress=${current} success=${succeeded} failed=${failed}`,
      );
    }

    await finishJob(JOBS.OLD);
    console.log(`[OLD] 完了 success=${succeeded} failed=${failed}`);
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
