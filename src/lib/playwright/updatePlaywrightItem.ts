/**
 * Playwright 年齢認証処理
 *
 * 完成済（2026-07-07）
 *
 * このファイルは発掘LAB v1.0の正式実装です。
 * 年齢認証処理は確認済みのため、原則修正禁止。
 */

import { chromium, Browser } from "playwright";
import { supabase } from "@/lib/supabase";

import { parsePage } from "./parser";
import { saveWork } from "./save";

export async function updatePlaywrightItem(
  productId: string,
  url?: string | null,
  browser?: Browser
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

  const ownBrowser = !browser;

browser ??= await chromium.launch({
  headless: true,
});

  const page = await browser.newPage();

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
      console.log("年齢認証は表示されませんでした");
    }

    const data = await parsePage(page);

    console.log(
  "prices =",
  JSON.stringify(data.prices, null, 2)
);

    await saveWork(productId, data);

    console.log("Playwright更新:", productId);
  } finally {
  if (ownBrowser) {
    await browser.close();
  }
}
}