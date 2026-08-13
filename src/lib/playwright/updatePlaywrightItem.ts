/**
 * Playwright 年齢認証処理
 *
 * 完成済（2026-07-07）
 *
 * このファイルは発掘LAB v1.0の正式実装です。
 * 年齢認証処理は確認済みのため、原則修正禁止。
 */

import type { Browser } from "playwright-core";
import { createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { parsePage } from "./parser";
import { saveWork } from "./save";

export async function updatePlaywrightItem(
  productId: string,
  url?: string | null,
  browser?: Browser,
  listPrice?: number | null,
  sampleMovieOnly = false
)
{
  let workUrl: string | undefined =
  url ?? undefined;

if (!workUrl) {
  const { data: work, error } = await supabase
    .from("works")
    .select("url")
    .eq("product_id", productId)
    .single();

  if (error || !work?.url) {
    console.log("URLが見つかりません:", productId);
    return;
  }

  workUrl = work.url ?? undefined;
}

  // Serverless Chromium can exit after its last page closes. Treat a passed,
  // disconnected instance like no browser so the next item can recover.
  let ownBrowser = !browser || !browser.isConnected();

  if (!browser?.isConnected()) {
    console.warn(`[browser] recreating disconnected Chromium for ${productId}`);
    browser = await createBrowser();
  }

  let page;

  try {
    page = await browser.newPage();
  } catch (error) {
    // The disconnected event may arrive just after isConnected() was checked.
    // Retry once with a fresh process instead of failing the whole update job.
    if (browser.isConnected()) throw error;

    console.warn(`[browser] newPage failed after disconnect; retrying ${productId}`);
    browser = await createBrowser();
    ownBrowser = true;
    page = await browser.newPage();
  }

  // Product images and fonts are not needed for parsing. Blocking them keeps
  // serverless Chromium below its memory limit while preserving media requests
  // used to discover sample movie URLs.
  if (process.env.VERCEL) {
    await page.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();

      if (resourceType === "image" || resourceType === "font") {
        await route.abort();
        return;
      }

      await route.continue();
    });
  }

  let sampleMovieUrl: string | null = null;

page.on("response", (response) => {
  const responseUrl = response.url();

  if (
    responseUrl.endsWith(".mp4") &&
    sampleMovieUrl === null
  ) {
    sampleMovieUrl = responseUrl;

    console.log(
      `[MP4] ${productId} ${sampleMovieUrl}`
    );
  }
});

  try {

    if (!workUrl) {
  console.log("URLが見つかりません:", productId);
  return;
}
    await page.goto(workUrl, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});



    // 年齢認証画面の表示待ち
    await page.waitForTimeout(5000);

    // 年齢認証が表示された場合のみ突破
    try {
      await page.locator("text=はい").first().click();

      await page.waitForLoadState("networkidle");

await page.waitForTimeout(3000);

console.log("年齢認証を突破しました");

    } catch {
      console.log(
  `[INFO] ${productId} 年齢認証スキップ`
);
    }

    const data = await parsePage(page);

    data.sampleMovieUrl = sampleMovieUrl ?? undefined;

console.log(
  "[SampleMovie]",
  sampleMovieUrl
);

// 価格取得失敗なら保存しない
if (data.prices.length === 0) {
  console.log(
    `[SKIP] ${productId} prices=[] url=${workUrl}`
  );
  return;
}

let saved = false;
let lastSaveError: unknown = null;

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    if (sampleMovieOnly) {
  await supabase
    .from("works")
    .update({
      sample_movie_url:
        data.sampleMovieUrl,
    })
    .eq("product_id", productId);

  saved = true;
  break;
}

await saveWork(
  productId,
  data,
  listPrice
);

saved = true;
break;
  } catch (error) {
    lastSaveError = error;

    console.error(
      `[ERROR] saveWork失敗 (${attempt}/3) ${productId}`,
      error
    );

    if (attempt < 3) {
      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );
    }
  }
}

if (!saved) {
  console.error(
    `[SKIP] saveWorkを3回試行しましたが失敗しました: ${productId}`
  );

  throw lastSaveError instanceof Error
    ? lastSaveError
    : new Error(
        `saveWorkを3回試行しましたが失敗しました: ${productId}`
      );
}

console.log(
  `[OK] ${productId} 更新完了`
);
  } finally {
  try {
    await page.close();
  } catch (e) {
    console.error("page.close失敗", e);
  }

  if (ownBrowser) {
    await browser.close();
  }
}
}
