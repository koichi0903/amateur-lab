import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaPageWithSelector } from "@/lib/playwright/fanzaAgeGate";

export interface RankingItem {
  rank: number;
  name: string;
}

export async function getPeriodActressRanking(
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number,
  linkSelector: string,
) {
  const browser = await createBrowser({ headless: false });
  const page = await browser.newPage();

  try {
    const rankings = new Map<string, RankingItem>();

    for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
      const pageUrl =
        currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
      const linkCount = await openFanzaPageWithSelector(
        page,
        pageUrl,
        linkSelector,
        {
          minimumCount: itemsPerPage,
          label: "entity-ranking",
        },
      );
      const names = await page.locator(linkSelector).allInnerTexts();
      const uniqueNames = [
        ...new Set(names.map((name) => name.trim()).filter(Boolean)),
      ];

      console.log(
        `page ${currentPage}: links=${linkCount}, uniqueEntities=${uniqueNames.length}`,
      );

      if (uniqueNames.length < itemsPerPage) {
        throw new Error(
          `FANZA entity ranking is incomplete: page=${currentPage}, expected=${itemsPerPage}, actual=${uniqueNames.length}, url=${page.url()}`,
        );
      }

      for (const name of uniqueNames.slice(0, itemsPerPage)) {
        if (rankings.has(name)) continue;
        rankings.set(name, {
          rank: rankings.size + 1,
          name,
        });
      }
    }

    const expectedCount = itemsPerPage * maxPages;
    if (rankings.size < expectedCount) {
      throw new Error(
        `FANZA entity ranking total is incomplete: expected=${expectedCount}, actual=${rankings.size}`,
      );
    }

    return [...rankings.values()].slice(0, expectedCount);
  } finally {
    await browser.close();
  }
}
