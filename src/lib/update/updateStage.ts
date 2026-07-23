import { supabase } from "@/lib/supabase";
import { getAllWorks } from "@/lib/supabase/getAllWorks";
import { getNewItems } from "@/lib/playwright/getNewItems";
import { getSemiNewItems } from "@/lib/playwright/getSemiNewItems";
import { getReserveItems } from "@/lib/playwright/getReserveItems";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

type Stage =
  | "RESERVED"
  | "NEW"
  | "SEMI_NEW"
  | "OLD";

export async function updateStage() {
  try {
    console.log("=== Stage同期開始 ===");

    const [
  { products: reserveProducts },
  { products: newProducts },
  { products: semiNewProducts },
] = await Promise.all([
  getReserveItems(),
  getNewItems(),
  getSemiNewItems(),
]);

    const newSet = new Set(
  newProducts.map((p) => p.productId)
);

const semiNewSet = new Set(
  semiNewProducts.map((p) => p.productId)
);

const reserveSet = new Set(
  reserveProducts.map((p) => p.productId)
);
    

    const works = await getAllWorks<{
  id: number;
  product_id: string;
  stage: Stage;
  product_release_date: string | null;
}>(
  "id, product_id, stage, product_release_date"
);

const job = await beginJob(
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

if (reserveSet.has(work.product_id)) {
  nextStage = "RESERVED";
} else if (newSet.has(work.product_id)) {
  nextStage = "NEW";
} else if (semiNewSet.has(work.product_id)) {
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

    console.log(
  "最後",
  "processed =", processed,
  "works.length =", works.length
);

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