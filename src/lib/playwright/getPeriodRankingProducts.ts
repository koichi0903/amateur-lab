import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaPageWithSelector } from "@/lib/playwright/fanzaAgeGate";

export interface RankingProduct {
  productId: string;
  ranking: number;
}

const PRODUCT_LINK_SELECTOR = 'a[href*="/av/content/?id="]';

export async function getPeriodRankingProducts(
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number,
) {
  const browser = await createBrowser({ headless: false });
  const page = await browser.newPage();

  try {
    const products = new Map<string, RankingProduct>();

    for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
      const pageUrl =
        currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
      const linkCount = await openFanzaPageWithSelector(
        page,
        pageUrl,
        PRODUCT_LINK_SELECTOR,
        {
          minimumCount: itemsPerPage,
          label: "period-ranking",
        },
      );

      const hrefs = await page.locator(PRODUCT_LINK_SELECTOR).evaluateAll(
        (links) => links
          .map((link) => link.getAttribute("href"))
          .filter((href): href is string => Boolean(href)),
      );
      const pageProductIds = [
        ...new Set(
          hrefs
            .map((href) => href.match(/id=([^&]+)/)?.[1])
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      console.log(
        `page ${currentPage}: links=${linkCount}, uniqueProducts=${pageProductIds.length}`,
      );

      if (pageProductIds.length < itemsPerPage) {
        throw new Error(
          `FANZA period ranking is incomplete: page=${currentPage}, expected=${itemsPerPage}, actual=${pageProductIds.length}, url=${page.url()}`,
        );
      }

      for (const productId of pageProductIds.slice(0, itemsPerPage)) {
        if (products.has(productId)) continue;
        products.set(productId, {
          productId,
          ranking: products.size + 1,
        });
      }
    }

    const expectedCount = itemsPerPage * maxPages;
    if (products.size < expectedCount) {
      throw new Error(
        `FANZA period ranking total is incomplete: expected=${expectedCount}, actual=${products.size}`,
      );
    }

    return [...products.values()].slice(0, expectedCount);
  } finally {
    await browser.close();
  }
}
