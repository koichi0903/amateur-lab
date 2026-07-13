import { supabase } from "@/lib/supabase";
import { UPDATE_CONFIG } from "@/config/update";
import { updateWork } from "./updateWork";
import { getSaleItems } from "@/lib/playwright/getSaleItems";

import {
  beginJob,
  updateJob,
  finishJob,
  failJob,
  JOBS,
} from "@/lib/jobs";

export async function updateSaleWorks() {
  const { products } = await getSaleItems();

  console.log(
  products.slice(0, 5)
);

const saleIds = new Set(
  products.map((p) => p.productId)
);

console.log("saleIds =", saleIds.size);

const allWorks: {
  product_id: string;
  url: string | null;
  price: number | null;
  sale_price: number | null;
  is_on_sale: boolean | null;
  sale_end_at: string | null;
}[] = [];

let from = 0;
const pageSize = 1000;

while (true) {
  const { data, error } = await supabase
    .from("works")
    .select(`
      product_id,
      url,
      price,
      sale_price,
      is_on_sale,
      sale_end_at
    `)
    .range(from, from + pageSize - 1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    break;
  }

  allWorks.push(...data);

  if (data.length < pageSize) {
    break;
  }

  from += pageSize;
}

console.log("allWorks =", allWorks.length);

console.log(
  "セール先頭10件",
  products.slice(0, 10).map((p) => p.productId)
);

console.log(
  "DB先頭10件",
  (allWorks ?? [])
    .slice(0, 10)
    .map((w) => w.product_id)
);

const works =
  (allWorks ?? []).filter((work) =>
    saleIds.has(work.product_id)
  );

  console.log(
  "一致サンプル",
  works
    .slice(0, 10)
    .map((w) => w.product_id)
);

console.log(
  "セール一覧一致件数 =",
  works.length
);

if (works.length === 0) {
  console.log("更新対象のセール作品はありません");
  return;
}

  const job = await beginJob(
    JOBS.SALE,
    works.length
  );

  const processedCount =
    job.processed_count ?? 0;

  const targets = works.slice(processedCount);

  console.log(
    `セール更新開始 (${processedCount}/${works.length}から再開)`
  );

  try {
    for (
      let i = 0;
      i < targets.length;
      i += UPDATE_CONFIG.parallel
    ) {
      const batch = targets.slice(
        i,
        i + UPDATE_CONFIG.parallel
      );

      await Promise.all(
  batch.map(async (work) => {
    const needsPlaywright =
  !work.sale_price ||
  !work.sale_end_at;

    if (!needsPlaywright) {
      return;
    }

    await updateWork(work.product_id);
  })
);

      const processed =
        processedCount + i + batch.length;

      await updateJob(
  JOBS.SALE,
  processed,
  batch[batch.length - 1].product_id
);

      console.log(
        `${processed}/${works.length}`
      );
    }

    await finishJob(JOBS.SALE);

    console.log("セール更新完了");
  } catch (error) {
    await failJob(
      JOBS.SALE,
      error instanceof Error
        ? error.message
        : String(error)
    );

    throw error;
  }
}