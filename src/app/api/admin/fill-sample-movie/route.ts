import { NextResponse } from "next/server";
import { UPDATE_CONFIG } from "@/config/update";
import {
  closeBrowser,
  createBrowser,
} from "@/lib/playwright/browserManager";
import type { Browser, BrowserContext } from "playwright-core";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import {
  updatePlaywrightItem,
  type PlaywrightUpdateResult,
} from "@/lib/playwright/updatePlaywrightItem";
import { beginJob, failJob, finishJob, JOBS, updateJob } from "@/lib/jobs";

export const maxDuration = 300;

type Target = { product_id: string; url: string | null };
type SettledUpdate = PromiseSettledResult<PlaywrightUpdateResult>;

async function loadTargets(): Promise<Target[]> {
  const pageSize = 1000;
  const targets: Target[] = [];
  const recheckBefore = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Snapshot before updating. Paging a shrinking NULL result set skips rows.
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id,url")
      .is("sample_movie_url", null)
      .neq("stage", "DISCONTINUED")
      .or(
        `sample_movie_checked_at.is.null,sample_movie_checked_at.lt.${recheckBefore}`,
      )
      .order("product_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;

    targets.push(...data);
    if (data.length < pageSize) break;
  }

  return targets;
}

export async function POST() {
  let success = 0;
  let missing = 0;
  let failed = 0;

  try {
    const targets = await loadTargets();
    await beginJob(JOBS.SAMPLE_MOVIE, targets.length);

    if (targets.length === 0) {
      await finishJob(JOBS.SAMPLE_MOVIE);
      return NextResponse.json({
        success,
        missing,
        failed,
        message: "サンプル動画の未確認作品はありません",
      });
    }

    let browser: Browser = await createBrowser();
    let context: BrowserContext = await createSampleMovieContext(browser);
    let nextBrowserRestart = UPDATE_CONFIG.browserRestartInterval;
    try {
      for (
        let offset = 0;
        offset < targets.length;
        offset += UPDATE_CONFIG.sampleMovieParallel
      ) {
        if (
          offset > 0 &&
          offset >= nextBrowserRestart
        ) {
          await context.close().catch(() => undefined);
          await closeBrowser(browser);
          browser = await createBrowser();
          context = await createSampleMovieContext(browser);
          while (nextBrowserRestart <= offset) {
            nextBrowserRestart += UPDATE_CONFIG.browserRestartInterval;
          }
        }

        const batch = targets.slice(
          offset,
          offset + UPDATE_CONFIG.sampleMovieParallel,
        );
        const firstResults = await Promise.allSettled(
          batch.map((work) =>
            updatePlaywrightItem(
              work.product_id,
              work.url,
              browser,
              undefined,
              true,
              null,
              context,
            ),
          ),
        );

        const retryTargets = batch.filter(
          (_, index) => firstResults[index].status === "rejected",
        );
        let retryResults: SettledUpdate[] = [];
        if (retryTargets.length > 0) {
          await context.close().catch(() => undefined);
          await closeBrowser(browser);
          browser = await createBrowser();
          context = await createSampleMovieContext(browser);
          retryResults = await Promise.allSettled(
            retryTargets.map((work) =>
              updatePlaywrightItem(
                work.product_id,
                work.url,
                browser,
                undefined,
                true,
                null,
                context,
              ),
            ),
          );
        }

        let retryIndex = 0;
        firstResults.forEach((firstResult) => {
          const result: SettledUpdate =
            firstResult.status === "fulfilled"
              ? firstResult
              : retryResults[retryIndex++];

          if (result?.status === "fulfilled") {
            if (result.value === "updated") success++;
            else if (result.value === "sample_movie_missing") missing++;
            else failed++;
          } else {
            console.error("[SAMPLE_MOVIE_FAILED]", result?.reason);
            failed++;
          }
        });

        await updateJob(
          JOBS.SAMPLE_MOVIE,
          success + missing + failed,
          batch[batch.length - 1].product_id,
        );
      }
    } finally {
      await context.close().catch(() => undefined);
      await closeBrowser(browser);
    }

    if (failed > 0) {
      const message = `サンプル動画補完に${failed}件の失敗が残りました`;
      await failJob(JOBS.SAMPLE_MOVIE, message);
      return NextResponse.json(
        { success, missing, failed, message },
        { status: 500 },
      );
    }

    await finishJob(JOBS.SAMPLE_MOVIE);
    return NextResponse.json({
      success,
      missing,
      failed,
      message: `動画URL補完が完了しました（保存${success}件・動画なし${missing}件）`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(JOBS.SAMPLE_MOVIE, message).catch(() => undefined);
    return NextResponse.json({ message }, { status: 500 });
  }
}

async function createSampleMovieContext(
  browser: Browser,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "age_check_done",
      value: "1",
      domain: ".dmm.co.jp",
      path: "/",
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "ckcy",
      value: "1",
      domain: ".dmm.co.jp",
      path: "/",
      secure: true,
      sameSite: "Lax",
    },
  ]);
  return context;
}
