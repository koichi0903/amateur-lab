import { supabase } from "@/lib/supabase";

import { getNewItems } from "@/lib/playwright/getNewItems";
import { getSemiNewItems } from "@/lib/playwright/getSemiNewItems";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

type Stage = "NEW" | "SEMI_NEW" | "OLD";

export async function updateStage() {
  try {
    console.log("=== Stage同期開始 ===");

    const [
      { productIds: newIds },
      { productIds: semiNewIds },
    ] = await Promise.all([
      getNewItems(),
      getSemiNewItems(),
    ]);

    const newSet = new Set(newIds);
    const semiNewSet = new Set(semiNewIds);

    const { data: works, error } = await supabase
      .from("works")
      .select("id, product_id, stage");

    if (error) {
      throw error;
    }

    if (!works) {
      throw new Error("作品取得失敗");
    }

    await beginJob(
      JOBS.STAGE,
      works.length
    );

    let processed = 0;

    const updates: {
  id: number;
  stage: Stage;
}[] = [];

    for (const work of works) {
      let nextStage: Stage = "OLD";

      if (newSet.has(work.product_id)) {
        nextStage = "NEW";
      } else if (
        semiNewSet.has(work.product_id)
      ) {
        nextStage = "SEMI_NEW";
      }

      if (work.stage !== nextStage) {
        updates.push({
  id: work.id,
  stage: nextStage,
});
      }

      processed++;

      if (processed % 100 === 0) {
        await updateJob(
          JOBS.STAGE,
          processed,
          work.product_id
        );
      }
    }

    console.log(
      `更新対象 ${updates.length} 件`
    );
        // 差分だけ更新
    for (const update of updates) {
      const { error } = await supabase
        .from("works")
        .update({
          stage: update.stage,
        })
        .eq("id", update.id);

      if (error) {
        throw error;
      }
    }

    await updateJob(
  JOBS.STAGE,
  processed,
  works.at(-1)?.product_id ?? ""
);

    await finishJob(JOBS.STAGE);

    console.log(
      `Stage同期完了（${updates.length}件更新）`
    );
  } catch (error) {
    await failJob(
      JOBS.STAGE,
      error instanceof Error
        ? error.message
        : String(error)
    );

    throw error;
  }
}