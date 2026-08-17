import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaPage } from "@/lib/playwright/fanzaAgeGate";

export interface RankingProduct {
  productId: string;
  ranking: number;
}

export async function getPeriodRankingProducts(
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number
) {
  const browser = await createBrowser({ headless: false });

  const page = await browser.newPage();

  try {
    await openFanzaPage(page, baseUrl);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const products = new Map<string, RankingProduct>();

    for (
      let currentPage = 1;
      currentPage <= maxPages;
      currentPage++
    ) {
      if (currentPage > 1) {
        await openFanzaPage(page, `${baseUrl}&page=${currentPage}`);

        await page.waitForTimeout(1000);
      }

      const links = page.locator(
  'a[href*="/av/content/?id="]'
);

let count = 0;

for (let retry = 1; retry <= 3; retry++) {
  // 最大10秒待って、必要数のリンクが揃うか確認
  try {
    await page.waitForFunction(
      (expected) => {
        return document.querySelectorAll(
          'a[href*="/av/content/?id="]'
        ).length >= expected;
      },
      itemsPerPage,
      {
        timeout: 10000,
      }
    );
  } catch {
    // タイムアウトしたら後でリロードを試す
  }

  count = await links.count();

  if (count >= itemsPerPage) {
    break;
  }

  console.log(
    `page ${currentPage}: links=${count} (Retry ${retry}/3)`
  );

  await page.waitForTimeout(3000);

  await page.reload({
    waitUntil: "domcontentloaded",
  });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

console.log(
  `page ${currentPage}: links=${count}`
);

console.log(
  `Expected: ${itemsPerPage}, Got: ${count}`
);

if (count < itemsPerPage) {
  console.warn(
    `⚠ page ${currentPage}: expected ${itemsPerPage}, got ${count}`
  );
}

if (count === 0) {
  throw new Error(
    `FANZAランキングを取得できませんでした: page=${currentPage}, url=${page.url()}`
  );
}

      for (let i = 0; i < count; i++) {
        const href = await links
          .nth(i)
          .getAttribute("href");

        if (!href) continue;

        const productId =
          href.match(/id=([^&]+)/)?.[1];

        if (!productId) continue;

        if (products.has(productId)) continue;

        products.set(productId, {
          productId,
          ranking: products.size + 1,
        });
      }
    }

    return [...products.values()];
  } finally {
    await browser.close();
  }
}
