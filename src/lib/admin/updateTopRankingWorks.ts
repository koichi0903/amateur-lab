import { createClient } from "@supabase/supabase-js";
import type { DmmItem } from "@/types/dmm";
import { updateWork } from "./updateWork";
import { UPDATE_CONFIG } from "@/config/update";
import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateTopRankingWorks(
  rankingItems: DmmItem[]
) {
  try {
    console.log("ランキング作品詳細更新開始");

    const { data: worksForStatus } = await supabase
      .from("works")
      .select(`
        product_id,
        playwright_status
      `);

    const statusMap = new Map(
      (worksForStatus ?? []).map((work) => [
        work.product_id,
        work.playwright_status,
      ])
    );

    const rankingTargets = rankingItems.slice(0, 100);

    const job = await beginJob(
      JOBS.RANKING,
      rankingTargets.length
    );

    let processed = job.processed_count ?? 0;

    const targets = rankingTargets.filter(
      (item) =>
        statusMap.get(item.content_id) !== "SALE"
    );

    console.log(`Playwright対象 ${targets.length}件`);

    const PLAYWRIGHT_BATCH_SIZE =
      UPDATE_CONFIG.parallel;

    for (
      let i = 0;
      i < targets.length;
      i += PLAYWRIGHT_BATCH_SIZE
    ) {
      const batch = targets.slice(
        i,
        i + PLAYWRIGHT_BATCH_SIZE
      );

      await Promise.all(
        batch.map((item) =>
          updateWork(item.content_id, item)
        )
      );

      processed += batch.length;

      await updateJob(
        JOBS.RANKING,
        processed,
        batch[batch.length - 1].content_id
      );

      console.log(
        `Playwright ${Math.min(
          i + PLAYWRIGHT_BATCH_SIZE,
          targets.length
        )}/${targets.length}`
      );
    }

    console.log("ランキング作品詳細更新完了");

    await finishJob(JOBS.RANKING);
  } catch (error) {
    await failJob(
      JOBS.RANKING,
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    throw error;
  }
}