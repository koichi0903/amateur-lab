import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  const { data: works, error } = await supabase
    .from("works")
    .select("product_id, url")
    .is("sample_movie_url", null);

  if (error) {
    console.error(error);
    return;
  }

  if (!works || works.length === 0) {
    console.log("更新対象はありません。");
    return;
  }

  console.log(`動画URL未取得: ${works.length}件`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < works.length; i++) {
    const work = works[i];

    console.log(
      `[${i + 1}/${works.length}] ${work.product_id}`
    );

    try {
      await updatePlaywrightItem(
        work.product_id,
        work.url,
        undefined,
        undefined,
        true // sampleMovieOnly
      );

      success++;
    } catch (e) {
      failed++;

      console.error(
        `[FAILED] ${work.product_id}`,
        e
      );
    }
  }

  console.log("");
  console.log("========== 完了 ==========");
  console.log(`成功 : ${success}`);
  console.log(`失敗 : ${failed}`);
}

main();