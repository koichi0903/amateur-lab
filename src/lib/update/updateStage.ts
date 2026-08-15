import { JOBS, beginJob, failJob, finishJob, updateJob } from "@/lib/jobs";
import { getNewItems } from "@/lib/playwright/getNewItems";
import { getReserveItems } from "@/lib/playwright/getReserveItems";
import { getSemiNewItems } from "@/lib/playwright/getSemiNewItems";
import { getAllWorks } from "@/lib/supabase/getAllWorks";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

type PublicStage = "RESERVED" | "NEW" | "SEMI_NEW" | "OLD";
type StoredStage = PublicStage | "DISCONTINUED";
type ListResult = Awaited<ReturnType<typeof getReserveItems>>;

const UPDATE_BATCH_SIZE = 500;

function validateList(name: string, result: ListResult) {
  if (result.products.length === 0) {
    throw new Error(`${name}一覧が0件のため、Stage同期を中止しました。`);
  }
  if (result.failedPages.length > 0) {
    throw new Error(
      `${name}一覧の取得に失敗したページがあります (${result.failedPages.join(", ")})。Stage同期を中止しました。`,
    );
  }
  if (result.requestedPages !== result.totalPages) {
    throw new Error(`${name}一覧が全ページ取得されていないため、Stage同期を中止しました。`);
  }
}

export async function updateStage() {
  try {
    console.log("=== Stage同期開始（手動修復） ===");

    const reserveResult = await getReserveItems();
    validateList("予約作品", reserveResult);
    const newResult = await getNewItems();
    validateList("新作", newResult);
    const semiNewResult = await getSemiNewItems();
    validateList("準新作", semiNewResult);

    const reserveSet = new Set(reserveResult.products.map((item) => item.productId));
    const newSet = new Set(newResult.products.map((item) => item.productId));
    const semiNewSet = new Set(semiNewResult.products.map((item) => item.productId));

    const works = await getAllWorks<{
      id: number;
      product_id: string;
      stage: StoredStage;
    }>("id, product_id, stage");

    const eligibleWorks = works.filter((work) => work.stage !== "DISCONTINUED");
    await beginJob(JOBS.STAGE, eligibleWorks.length);

    const updatesByStage: Record<PublicStage, number[]> = {
      RESERVED: [],
      NEW: [],
      SEMI_NEW: [],
      OLD: [],
    };

    for (const work of eligibleWorks) {
      let nextStage: PublicStage = "OLD";
      if (reserveSet.has(work.product_id)) nextStage = "RESERVED";
      else if (newSet.has(work.product_id)) nextStage = "NEW";
      else if (semiNewSet.has(work.product_id)) nextStage = "SEMI_NEW";

      if (work.stage !== nextStage) updatesByStage[nextStage].push(work.id);
    }

    const updateCount = Object.values(updatesByStage).reduce(
      (total, ids) => total + ids.length,
      0,
    );
    console.log(`Stage更新対象 ${updateCount}件`);

    let applied = 0;
    for (const [stage, ids] of Object.entries(updatesByStage) as [PublicStage, number[]][]) {
      for (let index = 0; index < ids.length; index += UPDATE_BATCH_SIZE) {
        const batch = ids.slice(index, index + UPDATE_BATCH_SIZE);
        const { error } = await supabase.from("works").update({ stage }).in("id", batch);
        if (error) throw error;

        applied += batch.length;
        await updateJob(JOBS.STAGE, applied, `${stage}: ${applied}/${updateCount}`);
      }
    }

    await finishJob(JOBS.STAGE);
    console.log(`Stage同期完了: ${updateCount}件更新`);
  } catch (error) {
    await failJob(JOBS.STAGE, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
