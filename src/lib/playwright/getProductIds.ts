import { chromium } from "playwright";

export interface ProductSummary {
  productId: string;

  url: string;
}

export async function getProductIds(
  baseUrl: string
) {
  const browser = await chromium.launch({
  headless: true
});

  const page = await browser.newPage();

  try {
    await page.goto(baseUrl, {
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

    const products = new Map<
  string,
  ProductSummary
>();

    const maxPages = totalPages;

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
          .locator('a[href*="/content/?id="]')
          .first()
          .waitFor();
      }

      const cards = page.locator(
  'a[href*="/content/?id="]'
);

const count = await cards.count();

console.log(
  `page ${currentPage}: cards=${count}`
);

      for (let i = 0; i < count; i++) {
  const card = cards.nth(i);

  const href =
    await card.getAttribute("href");

  if (!href) continue;

  const productId =
    href.match(/id=([^&]+)/)?.[1];

  if (!productId) continue;

const container = card.locator(
  "xpath=ancestor::div[@data-e2eid='content-card']"
);

  products.set(productId, {
  productId,
  url: href,
});
}
    }

    console.log(
  "取得作品数 =",
  products.size,
  "総ページ数 =",
  totalPages
);

    return {
  totalPages,
  products: [...products.values()],
};
  } finally {
    await browser.close();
  }
}