import { createClient } from "@supabase/supabase-js";
import { getSemiNewItems } from "@/lib/playwright/getSemiNewItems";
import { UPDATE_CONFIG } from "@/config/update";
import { saveDmmItem } from "./save";
import { updateWork } from "./updateWork";
import { getDmmItem } from "@/lib/dmm/getDmmItem";
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

export async function initializeSemiNewWorks() {
  console.log("===== 準新作初期登録開始 =====");

  const result = await getSemiNewItems();

  console.log(
    "Playwright取得件数:",
    result.products.length
  );

  const { data: works, error } = await supabase
    .from("works")
    .select("product_id");

  if (error) {
    throw error;
  }

  const workMap = new Set(
    (works ?? []).map((w) => w.product_id)
  );

  const newProducts = result.products.filter(
    (item) => !workMap.has(item.productId)
  );

  console.log(
    "未登録作品:",
    newProducts.length
  );

  const job = await beginJob(
  JOBS.SEMI_NEW,
  newProducts.length
);

const processedCount =
  job.processed_count ?? 0;

const targets =
  newProducts.slice(processedCount);

console.log(
  `再開位置 ${processedCount}/${newProducts.length}`
);

  console.log("登録開始");

let success = 0;
let failed = 0;

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
    batch.map(async (product) => {
      try {
        // DMM APIから作品取得
        const item = await getDmmItem(
          product.productId
        );

        if (!item) {
          failed++;
          return;
        }

        const saved = await saveDmmItem(
  item,
  undefined
);

await updateWork(
  product.productId,
  item,
  undefined,
  undefined,
  { captureSampleMovie: saved },
);

if (saved) {
  success++;
}
      } catch (error) {
        failed++;

        console.error(
          product.productId,
          error
        );
      }
    })
  );

  await updateJob(
  JOBS.SEMI_NEW,
  processedCount + i + batch.length,
  batch[batch.length - 1].productId
);

  const processed =
  processedCount + i + batch.length;

console.log(
  `${processed}/${newProducts.length} 完了`
);
}

await finishJob(JOBS.SEMI_NEW);

console.log("================================");
console.log("準新作初期登録完了");
console.log(`登録成功 : ${success}`);
console.log(`失敗 : ${failed}`);
console.log("================================");

} catch (error) {
  await failJob(
    JOBS.SEMI_NEW,
    error instanceof Error
      ? error.message
      : String(error)
  );

  throw error;
}
}
