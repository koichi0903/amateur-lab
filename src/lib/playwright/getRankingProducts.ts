import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaContentListPage } from "@/lib/playwright/fanzaAgeGate";

export interface RankingProduct {
  productId: string;
  ranking: number;
  listPrice: number | null;
  salePrice: number | null;
}

function parseCardPrices(priceText: string) {
  const numbers =
    priceText.match(/\d[\d,]*/g)?.map((value) =>
      Number(value.replace(/,/g, "")),
    ) ?? [];

  if (numbers.length >= 2) {
    return { listPrice: numbers[0], salePrice: numbers[1] };
  }

  return {
    listPrice: numbers[0] ?? null,
    salePrice: null,
  };
}

export async function getRankingProducts(
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number,
  expectedCount?: number,
) {

  const browser = await createBrowser({ headless: false });

  const page = await browser.newPage();

  try {
    const products = new Map<string, RankingProduct>();

for (
  let currentPage = 1;
  currentPage <= maxPages;
  currentPage++
) {
  const pageUrl =
    currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
  const count = await openFanzaContentListPage(page, pageUrl);

  const cards = page.locator(
    '[data-e2eid="content-card"]'
  );

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

    const priceLocator = card.locator(
      '[data-e2eid="content-price"]'
    );
    const priceText =
      (await priceLocator.count()) > 0
        ? (await priceLocator.first().textContent()) ?? ""
        : "";
    const { listPrice, salePrice } = parseCardPrices(priceText);

    products.set(productId, {
      productId,
      ranking,
      listPrice,
      salePrice,
    });
  }
}

    const result = [...products.values()];
    const minimumCount = expectedCount ?? itemsPerPage * (maxPages - 1);
    if (result.length < minimumCount) {
      throw new Error(
        `FANZAランキング取得件数が不足しています: ${result.length}/${minimumCount}件`,
      );
    }

    return expectedCount ? result.slice(0, expectedCount) : result;
  } finally {
    await browser.close();
  }
}
