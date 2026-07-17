import { chromium } from "playwright";

export interface ProductSummary {
  productId: string;

  url: string;
}

export async function getProductIds(
  baseUrl: string,
  maxPages?: number
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

    const pageLimit =
  maxPages == null
    ? totalPages
    : Math.min(totalPages, maxPages);

    for (
  let currentPage = 1;
  currentPage <= pageLimit;
  currentPage++
)
    {
      if (currentPage > 1) {
  let loaded = false;

  for (let retry = 1; retry <= 3; retry++) {
    try {
      await page.goto(
        `${baseUrl}&page=${currentPage}`,
        {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        }
      );

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const retryCards = page.locator(
        'a[href*="/content/?id="]'
      );

      if ((await retryCards.count()) > 0) {
        loaded = true;
        break;
      }

      console.log(
        `page ${currentPage} retry ${retry}`
      );
    } catch {
      console.log(
        `page ${currentPage} retry ${retry} failed`
      );
    }
  }

  if (!loaded) {
    console.log(
      `page ${currentPage} をスキップ`
    );
    continue;
  }
}

const cards = page.locator(
  'a[href*="/content/?id="]'
);

if ((await cards.count()) === 0) {
  console.log(`page ${currentPage} 再読み込み`);

  await page.reload({
    waitUntil: "domcontentloaded",
  });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

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
  "取得ページ数 =",
  pageLimit,
  "/",
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