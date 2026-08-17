import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaContentListPage } from "@/lib/playwright/fanzaAgeGate";

export interface RankingProduct {
  productId: string;
  ranking: number;
}

export async function getLongHitProducts(
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number,
  expectedCount?: number,
): Promise<RankingProduct[]> {
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

    products.set(productId, {
      productId,
      ranking,
    });
  }
}

    const result = [...products.values()];
    const minimumCount = expectedCount ?? itemsPerPage * (maxPages - 1);
    if (result.length < minimumCount) {
      throw new Error(
        `FANZAロングヒット取得件数が不足しています: ${result.length}/${minimumCount}件`,
      );
    }

    return expectedCount ? result.slice(0, expectedCount) : result;
  } finally {
    await browser.close();
  }
}
