import { NextResponse } from "next/server";
import { createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

export async function POST() {
  let success = 0;
let failed = 0;
const pageSize = 1000;
const browserLimit = 500;

let from = 0;

while (true) {
  const { data: works, error } = await supabase
    .from("works")
    .select("product_id, url")
    .is("sample_movie_url", null)
    .range(from, from + pageSize - 1);

  if (error) {
    console.error(error);

    return NextResponse.json(
      { message: "取得失敗" },
      { status: 500 }
    );
  }

  if (!works || works.length === 0) {
    break;
  }
  let browser = await createBrowser();

  console.log(
    `=== ${from + 1} ～ ${from + works.length} 件目 ===`
  );

  const batchSize = 5;

for (let i = 0; i < works.length; i += batchSize) {
if (i > 0 && i % browserLimit === 0) {
  console.log("===== Browser再起動 =====");

  await browser.close();

  browser = await createBrowser();
}

  const batch = works.slice(i, i + batchSize);

  await Promise.all(
    batch.map(async (work) => {
      try {
        console.log(
          `[${success + failed + 1}] ${work.product_id}`
        );

        await updatePlaywrightItem(
  work.product_id,
  work.url,
  browser,
  undefined,
  true
);

        success++;
      } catch (e) {
        console.error(e);
        failed++;
      }
    })
  );
}

await browser.close();

  from += pageSize;
}

  return NextResponse.json({
    success,
    failed,
    message: "動画URL補完完了",
  });
}
