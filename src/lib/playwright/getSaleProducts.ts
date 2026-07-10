import { chromium } from "playwright";

export async function getSaleProducts() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  console.log("セールページへアクセス");

  await page.goto(
    "https://www.dmm.co.jp/digital/videoa/-/list/=/sort=sale/"
  );

  await page.waitForLoadState("networkidle");

  const productIds = await page.$$eval(
    'a[href*="cid="]',
    (links) => {
      const ids = links
        .map((link) => {
          const href = link.getAttribute("href") ?? "";
          const match = href.match(/cid=([^/&]+)/);
          return match?.[1];
        })
        .filter(Boolean);

      return [...new Set(ids)];
    }
  );

  console.log(
    `Playwright取得件数：${productIds.length}`
  );

  await browser.close();

  return productIds as string[];
}