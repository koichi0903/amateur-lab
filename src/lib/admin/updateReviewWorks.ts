import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { updateDmmItem } from "./update";
import {
  describeReviewUpdateError,
  withReviewDatabaseRetry,
} from "./reviewUpdateSupport";

type ReviewUpdateOptions = {
  maxItems?: number;
  timeBudgetMs?: number;
};

export type ReviewUpdateResult = {
  completed: boolean;
  processedCount: number;
  totalCount: number;
  batchProcessed: number;
  success: number;
  skip: number;
  failed: number;
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

type UpdateResult = "success" | "skip" | "failed";

const DMM_PARALLEL = 5;
const DB_PAGE_SIZE = 250;
const REVIEW_SELECT =
  "id, product_id, review_count, review_average, maker, series, url, release_date, actress";

export async function updateReviewWorks(
  options: ReviewUpdateOptions = {},
): Promise<ReviewUpdateResult> {
  try {
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

    if (totalCount === 0) {
      return {
        completed: true,
        processedCount: 0,
        totalCount: 0,
        batchProcessed: 0,
        success: 0,
        skip: 0,
        failed: 0,
      };
    }

    const job = runningJob ?? await withReviewDatabaseRetry(
      "ジョブ開始",
      () => beginJob(JOBS.REVIEW, totalCount),
    );
    const initialProcessedCount = Math.max(job.processed_count ?? 0, 0);
    const maxItems =
      options.maxItems === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(1, options.maxItems);
    const targetEnd = initialProcessedCount + maxItems;
    const deadline =
      options.timeBudgetMs && options.timeBudgetMs > 0
        ? Date.now() + options.timeBudgetMs
        : null;

    let success = 0;
    let skip = 0;
    let failed = 0;
    let current = initialProcessedCount;
    let reachedEnd = false;

    const updateOne = async (work: ReviewTarget): Promise<UpdateResult> => {
      try {
        const item = await getDmmItem(work.product_id);
        if (!item) return "skip";

        await updateDmmItem(
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
        return "success";
      } catch (error) {
        console.error(`[ERROR] ${work.product_id}`, error);
        return "failed";
      }
    };

    while (current < targetEnd) {
      if (
        current > initialProcessedCount &&
        deadline !== null &&
        Date.now() >= deadline
      ) {
        break;
      }

      const pageEnd = Math.min(targetEnd, current + DB_PAGE_SIZE);
      const requestedCount = pageEnd - current;
      const data = await withReviewDatabaseRetry(
        `対象作品の取得 ${current}-${pageEnd - 1}`,
        async () => {
          const result = await supabase
            .from("works")
            .select(REVIEW_SELECT)
            .order("id", { ascending: true })
            .range(current, pageEnd - 1);
          if (result.error) throw result.error;
          return result.data;
        },
      );

      const targets = (data ?? []) as ReviewTarget[];
      if (targets.length === 0) {
        reachedEnd = true;
        break;
      }

      for (let index = 0; index < targets.length; index += DMM_PARALLEL) {
        if (index > 0 && deadline !== null && Date.now() >= deadline) break;

        const batch = targets.slice(index, index + DMM_PARALLEL);
        const firstResults = await Promise.all(batch.map(updateOne));
        const retryTargets = batch.filter(
          (_, resultIndex) => firstResults[resultIndex] !== "success",
        );
        const retryResults =
          retryTargets.length > 0
            ? await Promise.all(retryTargets.map(updateOne))
            : [];
        const retryResultMap = new Map(
          retryTargets.map((work, retryIndex) => [
            work.product_id,
            retryResults[retryIndex],
          ]),
        );

        const unresolvedFailures: string[] = [];
        for (let resultIndex = 0; resultIndex < batch.length; resultIndex++) {
          const work = batch[resultIndex];
          const firstResult = firstResults[resultIndex];
          const finalResult =
            firstResult === "success"
              ? firstResult
              : retryResultMap.get(work.product_id) ?? firstResult;

          if (finalResult === "success") success++;
          else if (finalResult === "skip") {
            skip++;
            console.log(`[SKIP] ${work.product_id}`);
          } else {
            failed++;
            unresolvedFailures.push(work.product_id);
          }
        }

        if (unresolvedFailures.length > 0) {
          throw new Error(
            `Review update failed for: ${unresolvedFailures.join(", ")}`,
          );
        }

        current += batch.length;
        await withReviewDatabaseRetry(
          "ジョブ進捗の保存",
          () => updateJob(
            JOBS.REVIEW,
            current,
            batch.at(-1)?.product_id ?? "",
          ),
        );
        console.log(
          `Review update ${current}/${Math.max(current, totalCount)}`,
        );
      }

      if (current < pageEnd) break;
      if (targets.length < requestedCount) {
        reachedEnd = true;
        break;
      }
    }

    const completed = reachedEnd;
    if (completed) {
      await withReviewDatabaseRetry(
        "ジョブ完了の保存",
        () => finishJob(JOBS.REVIEW),
      );
    }

    return {
      completed,
      processedCount: current,
      totalCount,
      batchProcessed: current - initialProcessedCount,
      success,
      skip,
      failed,
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
