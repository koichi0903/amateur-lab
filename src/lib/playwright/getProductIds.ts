import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaContentListPage } from "@/lib/playwright/fanzaAgeGate";

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
    await openFanzaContentListPage(page, baseUrl);

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
        await openFanzaContentListPage(
          page,
          `${baseUrl}&page=${currentPage}`,
        );
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
