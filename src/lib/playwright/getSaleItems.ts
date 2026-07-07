import { chromium } from "playwright";

const SALE_URL =
  "https://video.dmm.co.jp/av/list/?campaign=all&sort=suggest";

export async function getSaleItems() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  try {
    // まず1ページ目へ
    await page.goto(SALE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // 年齢認証
    try {
      await page.waitForTimeout(5000);

      await page.locator("text=はい").first().click();

      await page
        .locator('a[href*="/content/?id="]')
        .first()
        .waitFor();
    } catch {}

    // 総ページ数取得
    const pageText =
      (await page
        .locator("text=/全\\d+ページ中/")
        .first()
        .textContent()) ?? "";

    const totalPages = Number(
      pageText.match(/全(\d+)ページ中/)?.[1] ?? 1
    );

    const productIds = new Set<string>();

    // 開発中は3ページだけ
    const maxPages = Math.min(totalPages, 3);

    for (
      let currentPage = 1;
      currentPage <= maxPages;
      currentPage++
    ) {
      if (currentPage > 1) {
        await page.goto(
          `${SALE_URL}&page=${currentPage}`,
          {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          }
        );

        await page
          .locator('a[href*="/content/?id="]')
          .first()
          .waitFor();
      }

      const hrefs = await page
        .locator('a[href*="/content/?id="]')
        .evaluateAll((elements) =>
          elements.map(
            (e) => (e as HTMLAnchorElement).href
          )
        );

      hrefs.forEach((href) => {
        const productId =
          href.match(/id=([^&]+)/)?.[1];

        if (productId) {
          productIds.add(productId);
        }
      });

      console.log(
        `Page ${currentPage}: ${productIds.size}件`
      );
    }

    return {
      totalPages,
      productIds: [...productIds],
    };
  } finally {
    await browser.close();
  }
}