import { createBrowser } from "@/lib/playwright/browserManager";

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
    await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // 年齢認証
    try {
  await page.locator("text=はい").first().click({
    timeout: 3000,
  });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
} catch {}

    const rankings = new Map<string, RankingItem>();

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