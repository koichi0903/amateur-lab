import { createBrowser } from "@/lib/playwright/browserManager";

export interface RankingProduct {
  productId: string;
  ranking: number;
}

export async function getRankingProducts(
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number
) {

  const browser = await createBrowser({ headless: false });

  const page = await browser.newPage();

  try {
    await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // 年齢認証（初回のみ）
    try {
      await page.waitForTimeout(5000);

      await page.locator("text=はい").first().click();

      await page
        .locator('[data-e2eid="content-card"]')
        .first()
        .waitFor();
    } catch {}

    const products = new Map<string, RankingProduct>();

for (
  let currentPage = 1;
  currentPage <= maxPages;
  currentPage++
) {
  if (currentPage > 1) {
    await page.goto(
      `${baseUrl}&page=${currentPage}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }
    );

    await page
      .locator('[data-e2eid="content-card"]')
      .first()
      .waitFor();

    await page.waitForTimeout(500);
  }

  const cards = page.locator(
    '[data-e2eid="content-card"]'
  );

  const count = await cards.count();

  console.log(
    `page ${currentPage}: cards=${count}`
  );

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);

    const href = await card
      .locator('a[href*="/content/?id="]')
      .first()
      .getAttribute("href");

    if (!href) continue;

    const productId =
      href.match(/id=([^&]+)/)?.[1];

    if (!productId) continue;

    const ranking =
      (currentPage - 1) *
        itemsPerPage +
      i +
      1;

    products.set(productId, {
      productId,
      ranking,
    });
  }
}

return [...products.values()];
  } finally {
    await browser.close();
  }
}