import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaContentListPage } from "@/lib/playwright/fanzaAgeGate";
import { assessRankingCoverage } from "./rankingCoverage";

export interface RankingProduct {
  productId: string;
  ranking: number;
  listPrice: number | null;
  salePrice: number | null;
}

const FULL_CRAWL_ATTEMPTS = 2;

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
  const minimumCount = expectedCount ?? itemsPerPage * (maxPages - 1);
  let bestResult: RankingProduct[] = [];
  let lastError: unknown;

  for (let attempt = 1; attempt <= FULL_CRAWL_ATTEMPTS; attempt += 1) {
    const browser = await createBrowser({ headless: false });
    const page = await browser.newPage();

    try {
      const products = new Map<string, RankingProduct>();
      let duplicateCount = 0;

      for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
        const pageUrl =
          currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
        const count = await openFanzaContentListPage(page, pageUrl);
        const cards = page.locator('[data-e2eid="content-card"]');

        console.log(`page ${currentPage}: cards=${count}`);

        for (let index = 0; index < count; index += 1) {
          const card = cards.nth(index);
          const href = await card
            .locator('a[href*="/content/?id="]')
            .first()
            .getAttribute("href");
          const productId = href?.match(/id=([^&]+)/)?.[1];
          if (!productId) continue;

          if (products.has(productId)) {
            duplicateCount += 1;
            continue;
          }

          const priceLocator = card.locator('[data-e2eid="content-price"]');
          const priceText =
            (await priceLocator.count()) > 0
              ? (await priceLocator.first().textContent()) ?? ""
              : "";
          const { listPrice, salePrice } = parseCardPrices(priceText);

          products.set(productId, {
            productId,
            ranking: (currentPage - 1) * itemsPerPage + index + 1,
            listPrice,
            salePrice,
          });
        }
      }

      const result = [...products.values()];
      if (result.length > bestResult.length) bestResult = result;

      const coverage = assessRankingCoverage(result.length, minimumCount);
      console.log(
        `[fanza-ranking] attempt=${attempt}/${FULL_CRAWL_ATTEMPTS} unique=${result.length} duplicates=${duplicateCount}`,
      );

      if (coverage.complete) {
        return expectedCount ? result.slice(0, expectedCount) : result;
      }

      lastError = new Error(
        `FANZAランキング取得件数が不足しています: ${result.length}/${minimumCount}件`,
      );
    } catch (error) {
      lastError = error;
      console.warn(
        `[fanza-ranking] full crawl ${attempt}/${FULL_CRAWL_ATTEMPTS} failed`,
        error,
      );
    } finally {
      await browser.close();
    }

    if (attempt < FULL_CRAWL_ATTEMPTS) {
      console.warn("[fanza-ranking] 全ページを再取得します");
    }
  }

  const bestCoverage = assessRankingCoverage(bestResult.length, minimumCount);
  if (bestCoverage.acceptable) {
    console.warn(
      `[fanza-ranking] ${bestResult.length}/${minimumCount}件の部分スナップショットを使用し、未取得順位を保持します`,
    );
    return expectedCount ? bestResult.slice(0, expectedCount) : bestResult;
  }

  const reason =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `FANZAランキング取得件数が安全基準未満です: ${bestResult.length}/${minimumCount}件 (${reason})`,
  );
}
