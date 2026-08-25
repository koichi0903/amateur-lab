import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { updateDmmItem } from "./update";

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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

export async function updateReviewWorks(
  options: ReviewUpdateOptions = {},
): Promise<ReviewUpdateResult> {
  try {
    const { count, error: countError } = await supabase
      .from("works")
      .select("id", { count: "exact", head: true });
    if (countError) throw countError;

    const totalCount = count ?? 0;
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

    const job = await beginJob(JOBS.REVIEW, totalCount);
    const initialProcessedCount = Math.min(
      job.processed_count ?? 0,
      totalCount,
    );
    const maxItems =
      options.maxItems === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(1, options.maxItems);
    const targetEnd = Math.min(
      totalCount,
      initialProcessedCount + maxItems,
    );
    const deadline =
      options.timeBudgetMs && options.timeBudgetMs > 0
        ? Date.now() + options.timeBudgetMs
        : null;

    let success = 0;
    let skip = 0;
    let failed = 0;
    let current = initialProcessedCount;

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
      const { data, error: pageError } = await supabase
        .from("works")
        .select(REVIEW_SELECT)
        .order("id", { ascending: true })
        .range(current, pageEnd - 1);
      if (pageError) throw pageError;

      const targets = (data ?? []) as ReviewTarget[];
      if (targets.length === 0) {
        throw new Error(
          `Review target page was empty at ${current}/${totalCount}`,
        );
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
        await updateJob(
          JOBS.REVIEW,
          Math.min(current, totalCount),
          batch.at(-1)?.product_id ?? "",
        );
        console.log(
          `Review update ${Math.min(current, totalCount)}/${totalCount}`,
        );
      }

      if (current < pageEnd) break;
    }

    const completed = current >= totalCount;
    if (completed) await finishJob(JOBS.REVIEW);

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
    const message = errorMessage(error);
    try {
      await failJob(JOBS.REVIEW, message);
    } catch (jobError) {
      console.error("Failed to record review job error:", jobError);
    }
    throw error;
  }
}
