import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { updateDmmItem } from "./update";
import {
  describeReviewUpdateError,
  withReviewDatabaseRetry,
} from "./reviewUpdateSupport";
import { processReviewBatch, type ReviewUpdateOutcome } from "./reviewUpdateBatch";
import { createReviewUpdatePlan, resolveReviewPageState, shouldStopReviewUpdateForDeadline, type ReviewUpdateOptions } from "./reviewUpdatePlan";

export type ReviewUpdateResult = {
  completed: boolean;
  processedCount: number;
  totalCount: number;
  batchProcessed: number;
  success: number;
  skip: number;
  failed: number;
  workIds: string[];
};

type ReviewTarget = {
  id: number;
  product_id: string;
  review_count: number;
  review_average: number;
  maker: string;
  series: string;
  url: string;
  release_date: string | null;
  actress: string | null;
};

const DMM_PARALLEL = 5;
const DB_PAGE_SIZE = 250;
const REVIEW_SELECT =
  "id, product_id, review_count, review_average, maker, series, url, release_date, actress";

type ReviewJobState = {
  processed_count: number | null;
  total_count: number | null;
};

type ReviewProgress = {
  current: number;
  success: number;
  skip: number;
  failed: number;
  workIds: string[];
};

async function initializeReviewJob(): Promise<{ totalCount: number; job: ReviewJobState | null }> {
  const runningJob = await withReviewDatabaseRetry(
      "ジョブ状態の取得",
      async () => {
        const result = await supabase
          .from("jobs")
          .select("job_name,status,processed_count,total_count,last_product_id")
          .eq("job_name", JOBS.REVIEW)
          .eq("status", "running")
          .maybeSingle();
        if (result.error) throw result.error;
        return result.data;
      },
    );

  let totalCount = runningJob?.total_count ?? 0;
  if (!runningJob) {
    totalCount = await withReviewDatabaseRetry(
      "作品件数の取得",
      async () => {
        const { count, error } = await supabase
          .from("works")
          .select("id", { count: "planned", head: true });
        if (error) throw error;
        return count ?? 0;
      },
    );
  }
  if (totalCount === 0) return { totalCount, job: null };

  const job = runningJob ?? await withReviewDatabaseRetry(
    "ジョブ開始",
    () => beginJob(JOBS.REVIEW, totalCount),
  );
  return { totalCount, job };
}

function createReviewUpdater() {
  return async (work: ReviewTarget): Promise<ReviewUpdateOutcome> => {
    try {
      const item = await getDmmItem(work.product_id);
      if (!item) return "skip";

      const changed = await updateDmmItem(
        item,
        {
          id: work.id,
          review_count: work.review_count ?? 0,
          review_average: work.review_average ?? 0,
          maker: work.maker ?? "",
          series: work.series ?? "",
          url: work.url ?? "",
          release_date: work.release_date,
          actress: work.actress,
        },
        {
          // Price and sale data remain owned by the Playwright updater.
          updatePrices: false,
        },
      );
      return changed ? "success" : "skip";
    } catch (error) {
      console.error(`[ERROR] ${work.product_id}`, error);
      return "failed";
    }
  };
}

async function processReviewTargets(
  targets: ReviewTarget[],
  deadline: number | null,
  totalCount: number,
  progress: ReviewProgress,
  updateOne: (work: ReviewTarget) => Promise<ReviewUpdateOutcome>,
) {
  for (let index = 0; index < targets.length; index += DMM_PARALLEL) {
    if (index > 0 && deadline !== null && Date.now() >= deadline) break;

    const batch = targets.slice(index, index + DMM_PARALLEL);
    const batchResult = await processReviewBatch(batch, updateOne);
    progress.success += batchResult.success;
    progress.skip += batchResult.skip;
    progress.failed += batchResult.failed;
    progress.workIds.push(...batchResult.workIds);
    for (const productId of batchResult.skippedWorkIds) {
      console.log(`[SKIP] ${productId}`);
    }

    if (batchResult.unresolvedFailures.length > 0) {
      throw new Error(`Review update failed for: ${batchResult.unresolvedFailures.join(", ")}`);
    }

    progress.current += batch.length;
    await withReviewDatabaseRetry(
      "ジョブ進捗の保存",
      () => updateJob(
        JOBS.REVIEW,
        progress.current,
        batch.at(-1)?.product_id ?? "",
      ),
    );
    console.log(`Review update ${progress.current}/${Math.max(progress.current, totalCount)}`);
  }
}

async function processReviewPages(options: {
  initialProcessedCount: number;
  targetEnd: number;
  deadline: number | null;
  totalCount: number;
  progress: ReviewProgress;
  updateOne: (work: ReviewTarget) => Promise<ReviewUpdateOutcome>;
}) {
  const { initialProcessedCount, targetEnd, deadline, totalCount, progress, updateOne } = options;
  let reachedEnd = false;

  while (progress.current < targetEnd) {
    if (shouldStopReviewUpdateForDeadline(progress.current, initialProcessedCount, deadline)) break;

    const pageStart = progress.current;
    const pageEnd = Math.min(targetEnd, pageStart + DB_PAGE_SIZE);
    const requestedCount = pageEnd - pageStart;
    const data = await withReviewDatabaseRetry(
      `対象作品の取得 ${pageStart}-${pageEnd - 1}`,
      async () => {
        const result = await supabase
          .from("works")
          .select(REVIEW_SELECT)
          .order("id", { ascending: true })
          .range(pageStart, pageEnd - 1);
        if (result.error) throw result.error;
        return result.data;
      },
    );

    const targets = (data ?? []) as ReviewTarget[];
    if (targets.length === 0) {
      reachedEnd = true;
      break;
    }

    await processReviewTargets(targets, deadline, totalCount, progress, updateOne);

    const pageState = resolveReviewPageState(progress.current, pageEnd, targets.length, requestedCount);
    if (pageState === "paused") break;
    if (pageState === "complete") {
      reachedEnd = true;
      break;
    }
  }

  return reachedEnd;
}

export async function updateReviewWorks(
  options: ReviewUpdateOptions = {},
): Promise<ReviewUpdateResult> {
  try {
    const { totalCount, job } = await initializeReviewJob();
    if (totalCount === 0 || !job) {
      return {
        completed: true,
        processedCount: 0,
        totalCount: 0,
        batchProcessed: 0,
        success: 0,
        skip: 0,
        failed: 0,
        workIds: [],
      };
    }

    const initialProcessedCount = Math.max(job.processed_count ?? 0, 0);
    const { targetEnd, deadline } = createReviewUpdatePlan(initialProcessedCount, options);
    const progress: ReviewProgress = {
      current: initialProcessedCount,
      success: 0,
      skip: 0,
      failed: 0,
      workIds: [],
    };
    const updateOne = createReviewUpdater();
    const reachedEnd = await processReviewPages({
      initialProcessedCount,
      targetEnd,
      deadline,
      totalCount,
      progress,
      updateOne,
    });

    const completed = reachedEnd;
    if (completed) {
      await withReviewDatabaseRetry(
        "ジョブ完了の保存",
        () => finishJob(JOBS.REVIEW),
      );
    }

    return {
      completed,
      processedCount: progress.current,
      totalCount,
      batchProcessed: progress.current - initialProcessedCount,
      success: progress.success,
      skip: progress.skip,
      failed: progress.failed,
      workIds: progress.workIds,
    };
  } catch (error) {
    const message = describeReviewUpdateError(error);
    try {
      await failJob(JOBS.REVIEW, message);
    } catch (jobError) {
      console.error("Failed to record review job error:", jobError);
    }
    throw error;
  }
}
