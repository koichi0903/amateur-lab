import { NextResponse } from "next/server";
import { createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { beginJob, failJob, finishJob, JOBS, updateJob } from "@/lib/jobs";

export const maxDuration = 300;

export async function POST() {
  let success = 0;
  let failed = 0;
  const pageSize = 1000;
  const browserLimit = 500;
  let from = 0;

  const { count, error: countError } = await supabase
    .from("works")
    .select("product_id", { count: "exact", head: true })
    .is("sample_movie_url", null);

  if (countError) {
    return NextResponse.json(
      { message: "対象件数の取得に失敗しました" },
      { status: 500 },
    );
  }

  await beginJob(JOBS.SAMPLE_MOVIE, count ?? 0);

  try {
    while (true) {
      const { data: works, error } = await supabase
        .from("works")
        .select("product_id, url")
        .is("sample_movie_url", null)
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!works?.length) break;

      let browser = await createBrowser();
      const batchSize = 5;

      try {
        for (let i = 0; i < works.length; i += batchSize) {
          if (i > 0 && i % browserLimit === 0) {
            await browser.close();
            browser = await createBrowser();
          }

          const batch = works.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (work) => {
              try {
                await updatePlaywrightItem(
                  work.product_id,
                  work.url,
                  browser,
                  undefined,
                  true,
                );
                success++;
              } catch (error) {
                console.error(error);
                failed++;
              }
            }),
          );

          await updateJob(
            JOBS.SAMPLE_MOVIE,
            success + failed,
            batch[batch.length - 1].product_id,
          );
        }
      } finally {
        await browser.close();
      }

      from += pageSize;
    }

    await finishJob(JOBS.SAMPLE_MOVIE);
    return NextResponse.json({
      success,
      failed,
      message: "動画URL補完が完了しました",
    });
  } catch (error) {
    await failJob(
      JOBS.SAMPLE_MOVIE,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
