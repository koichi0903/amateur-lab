import type { Browser } from "playwright-core";

import { UPDATE_CONFIG } from "@/config/update";
import { formatUnknownError } from "@/lib/errorMessage";
import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";
import {
  updatePlaywrightItem,
  type PlaywrightUpdateResult,
} from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { beginJob, failJob, finishJob, JOBS, updateJob } from "@/lib/jobs";

type SampleMovieTarget = {
  product_id: string;
  url: string;
};

const LOCAL_BATCH_LIMIT = 20;
const SERVERLESS_BATCH_LIMIT = 4;
const LOCAL_PARALLEL = 4;
const DATABASE_ATTEMPTS = 4;

type SampleMovieJob = {
  job_name: string;
  status: "completed" | "running" | "failed";
  processed_count: number;
  total_count: number;
  last_product_id: string | null;
};

function isStoppedError(error: unknown): boolean {
  return error instanceof Error && error.name === "JobStoppedError";
}

async function retryDatabaseOperation<T>(
  label: string,
  operation: () => Promise<T>,
  attempts = DATABASE_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (isStoppedError(error)) throw error;
      lastError = error;
      if (attempt === attempts) break;

      const delayMs = Math.min(2 ** (attempt - 1) * 2_000, 10_000);
      console.warn(
        `[sample-movie] ${label}に失敗しました。${delayMs}ms後に再試行します (${attempt}/${attempts}): ${formatUnknownError(error)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `${label}に${attempts}回失敗しました: ${formatUnknownError(lastError)}`,
    { cause: lastError },
  );
}

function resolveBatchLimit(): number {
  const configured = Number(process.env.SAMPLE_MOVIE_BATCH_LIMIT);
  if (Number.isInteger(configured) && configured > 0) {
    return Math.min(configured, 100);
  }

  return process.env.VERCEL ? SERVERLESS_BATCH_LIMIT : LOCAL_BATCH_LIMIT;
}

async function countTargets(afterProductId?: string | null): Promise<number> {
  return retryDatabaseOperation("動画補完対象件数の取得", async () => {
    const retryBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from("works")
      .select("product_id", { count: "exact", head: true })
      .is("sample_movie_url", null)
      .not("url", "is", null)
      .neq("stage", "DISCONTINUED")
      .or(`sample_movie_checked_at.is.null,sample_movie_checked_at.lt.${retryBefore}`);
    if (afterProductId) query = query.gt("product_id", afterProductId);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  });
}

async function beginOrResumeJob(): Promise<SampleMovieJob> {
  const currentJob = await retryDatabaseOperation(
    "動画補完ジョブ状態の取得",
    async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("job_name,status,processed_count,total_count,last_product_id")
        .eq("job_name", JOBS.SAMPLE_MOVIE)
        .maybeSingle();
      if (error) throw error;
      return data as SampleMovieJob | null;
    },
  );

  if (
    currentJob?.status === "failed" &&
    currentJob.processed_count > 0 &&
    currentJob.last_product_id
  ) {
    const remainingCount = await countTargets(currentJob.last_product_id);
    const totalCount = currentJob.processed_count + remainingCount;
    return retryDatabaseOperation("動画補完ジョブの再開", async () => {
      const { data, error } = await supabase
        .from("jobs")
        .update({
          status: "running",
          total_count: totalCount,
          error_message: null,
          finished_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("job_name", JOBS.SAMPLE_MOVIE)
        .eq("status", "failed")
        .select("job_name,status,processed_count,total_count,last_product_id")
        .single();
      if (error) throw error;

      console.log(
        `[sample-movie] ${currentJob.processed_count}/${totalCount}件から再開します (${currentJob.last_product_id})`,
      );
      return data as SampleMovieJob;
    });
  }

  const targetCount = await countTargets();
  return retryDatabaseOperation(
    "動画補完ジョブの開始",
    () => beginJob(JOBS.SAMPLE_MOVIE, targetCount) as Promise<SampleMovieJob>,
  );
}

async function loadTargets(
  afterProductId: string | null,
  limit: number,
): Promise<SampleMovieTarget[]> {
  return retryDatabaseOperation("動画補完対象の取得", async () => {
    const retryBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from("works")
      .select("product_id,url")
      .is("sample_movie_url", null)
      .not("url", "is", null)
      .neq("stage", "DISCONTINUED")
      .or(`sample_movie_checked_at.is.null,sample_movie_checked_at.lt.${retryBefore}`)
      .order("product_id", { ascending: true })
      .limit(limit);

    if (afterProductId) query = query.gt("product_id", afterProductId);

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).filter(
      (work): work is SampleMovieTarget => Boolean(work.url),
    );
  });
}

async function fillTarget(
  target: SampleMovieTarget,
  browser: Browser,
): Promise<PlaywrightUpdateResult> {
  return updatePlaywrightItem(
    target.product_id,
    target.url,
    browser,
    undefined,
    { captureSampleMovie: true, sampleMovieOnly: true },
  );
}

async function processTargets(
  targets: SampleMovieTarget[],
  browser: Browser,
): Promise<PromiseSettledResult<PlaywrightUpdateResult>[]> {
  const results: PromiseSettledResult<PlaywrightUpdateResult>[] = [];

  const parallel = process.env.VERCEL
    ? UPDATE_CONFIG.parallel
    : Math.min(UPDATE_CONFIG.parallel, LOCAL_PARALLEL);

  for (let offset = 0; offset < targets.length; offset += parallel) {
    const batch = targets.slice(offset, offset + parallel);
    results.push(
      ...(await Promise.allSettled(
        batch.map((target) => fillTarget(target, browser)),
      )),
    );
  }

  return results;
}

export async function fillSampleMovieUrls() {
  let browser: Browser | null = null;

  try {
    const job = await beginOrResumeJob();
    const processedBefore = job.processed_count ?? 0;
    const targets = await loadTargets(job.last_product_id, resolveBatchLimit());

    if (targets.length === 0) {
      await retryDatabaseOperation(
        "動画補完ジョブの完了記録",
        () => finishJob(JOBS.SAMPLE_MOVIE),
      );
      return {
        completed: true,
        processedCount: processedBefore,
        totalCount: job.total_count,
        saved: 0,
        missing: 0,
      };
    }

    browser = await createBrowser();
    let results = await processTargets(targets, browser);
    const retryTargets = targets.filter((_, index) => results[index].status === "rejected");

    if (retryTargets.length > 0) {
      console.warn(
        `[sample-movie] ${retryTargets.length}件をブラウザ再起動後に再試行します`,
      );
      await closeBrowser(browser);
      browser = await createBrowser();
      const retryResults = await processTargets(retryTargets, browser);
      let retryIndex = 0;
      results = results.map((result) =>
        result.status === "rejected" ? retryResults[retryIndex++] : result,
      );
    }

    const failures = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [{ productId: targets[index].product_id, reason: result.reason }]
        : [],
    );
    if (failures.length > 0) {
      throw new Error(
        `動画補完に${failures.length}件失敗しました: ${failures
          .map(({ productId }) => productId)
          .join(", ")}`,
      );
    }

    const saved = results.filter(
      (result) => result.status === "fulfilled" && result.value === "updated",
    ).length;
    const missing = results.filter(
      (result) =>
        result.status === "fulfilled" && result.value === "sample_movie_missing",
    ).length;
    const processedCount = processedBefore + targets.length;
    const totalCount = job.total_count;
    const lastProductId = targets[targets.length - 1].product_id;

    await retryDatabaseOperation(
      "動画補完進捗の保存",
      () => updateJob(
        JOBS.SAMPLE_MOVIE,
        processedCount,
        lastProductId,
      ),
    );

    const completed = targets.length < resolveBatchLimit() || processedCount >= totalCount;
    if (completed) {
      await retryDatabaseOperation(
        "動画補完ジョブの完了記録",
        () => finishJob(JOBS.SAMPLE_MOVIE),
      );
    }

    return {
      completed,
      processedCount,
      totalCount,
      saved,
      missing,
    };
  } catch (error) {
    const message = formatUnknownError(error);
    await retryDatabaseOperation(
      "動画補完ジョブの失敗記録",
      () => failJob(JOBS.SAMPLE_MOVIE, message),
      2,
    ).catch((recordError) => {
      console.error(
        `[sample-movie] 失敗状態を保存できませんでした: ${formatUnknownError(recordError)}`,
      );
    });
    throw new Error(message, { cause: error });
  } finally {
    if (browser) await closeBrowser(browser);
  }
}
