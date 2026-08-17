import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaPage } from "@/lib/playwright/fanzaAgeGate";

export interface RankingItem {
  rank: number;
  name: string;
}

export async function getPeriodActressRanking(
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number,
  linkSelector: string
) {

  const browser = await createBrowser({ headless: false });

  const page = await browser.newPage();

  try {
    await openFanzaPage(page, baseUrl);

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const rankings = new Map<string, RankingItem>();

    for (
      let currentPage = 1;
      currentPage <= maxPages;
      currentPage++
    ) {
      if (currentPage > 1) {
        await openFanzaPage(page, `${baseUrl}&page=${currentPage}`);

        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
      }

      const rankingLinks = page.locator(linkSelector);

      let count = 0;

      for (let retry = 1; retry <= 3; retry++) {
        count = await rankingLinks.count();

        if (count >= itemsPerPage) {
          break;
        }

        console.log(
          `page ${currentPage}: actresses=${count} (Retry ${retry}/3)`
        );

        await page.waitForTimeout(3000);

        await page.reload({
          waitUntil: "domcontentloaded",
        });

        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);
        
      }

      console.log(
  `page ${currentPage}: items=${count}`
);

      for (let i = 0; i < count; i++) {
        const name = (
  await rankingLinks.nth(i).innerText()
).trim();

        if (!name) continue;

        if (rankings.has(name)) continue;

rankings.set(name, {
  rank: rankings.size + 1,
  name,
});
      }
    }

    return [...rankings.values()];
  } finally {
    await browser.close();
  }
}
