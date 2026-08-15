import { createBrowser } from "@/lib/playwright/browserManager";

export interface ProductSummary {
  productId: string;
  url: string;

  // 通常価格
  listPrice: number | null;

  // セール価格（通常時は null）
  salePrice: number | null;
}

export async function getProductIds(
  baseUrl: string,
  maxPages?: number
) {
  const browser = await createBrowser({ headless: false });

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

    const failedPages: number[] = [];

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

      await page.locator(
  '[data-e2eid="content-card"]'
).first().waitFor({
  timeout: 10000,
});

await page.waitForTimeout(500);

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
    } catch (error) {
  console.log(
    `page ${currentPage} retry ${retry} failed`
  );

  console.error(error);
}
  }

  if (!loaded) {
    console.log(
      `page ${currentPage} をスキップ`
    );
    failedPages.push(currentPage);
    continue;
  }
}

const cards = page.locator(
  '[data-e2eid="content-card"]'
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


  const link = card.locator(
  'a[href*="/content/?id="]'
).first();

const href =
  await link.getAttribute("href");

  if (!href) continue;

  const productId =
  href.match(/id=([^&]+)/)?.[1];

if (!productId) continue;

const priceLocator = card.locator(
  '[data-e2eid="content-price"]'
);

const priceText =
  (await priceLocator.count()) > 0
    ? (await priceLocator.first().textContent()) ?? ""
    : "";

const numbers =
  priceText.match(/\d[\d,]*/g)?.map((v) =>
    Number(v.replace(/,/g, ""))
  ) ?? [];

let listPrice: number | null = null;
let salePrice: number | null = null;

if (numbers.length === 1) {
  // 通常販売
  listPrice = numbers[0];
} else if (numbers.length >= 2) {
  // セール中
  listPrice = numbers[0];
  salePrice = numbers[1];
}

products.set(productId, {
  productId,
  url: href,
  listPrice,
  salePrice,
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
  requestedPages: pageLimit,
  failedPages,
  products: [...products.values()],
};
  } finally {
    await browser.close();
  }
}
