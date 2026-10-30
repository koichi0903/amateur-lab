import type { Page } from "playwright-core";
import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaContentListPage } from "@/lib/playwright/fanzaAgeGate";
import { assessRankingCoverage } from "./rankingCoverage";
import { buildRankingProduct, parseRankingProductId, type RankingProduct } from "./rankingProductParsing";

export type { RankingProduct } from "./rankingProductParsing";

const FULL_CRAWL_ATTEMPTS = 2;

async function collectRankingPage(
  page: Page,
  pageUrl: string,
  currentPage: number,
  itemsPerPage: number,
  products: Map<string, RankingProduct>,
) {
  const count = await openFanzaContentListPage(page, pageUrl);
  const cards = page.locator('[data-e2eid="content-card"]');
  let duplicateCount = 0;

  console.log(`page ${currentPage}: cards=${count}`);

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    const href = await card
      .locator('a[href*="/content/?id="]')
      .first()
      .getAttribute("href");
    const productId = parseRankingProductId(href);
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
    const product = buildRankingProduct(
      productId,
      (currentPage - 1) * itemsPerPage + index + 1,
      priceText,
    );

    products.set(productId, product);
  }

  return duplicateCount;
}

async function collectFullRankingPages(
  page: Page,
  baseUrl: string,
  itemsPerPage: number,
  maxPages: number,
) {
  const products = new Map<string, RankingProduct>();
  let duplicateCount = 0;

  for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
    const pageUrl =
      currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
    duplicateCount += await collectRankingPage(
      page,
      pageUrl,
      currentPage,
      itemsPerPage,
      products,
    );
  }

  return { result: [...products.values()], duplicateCount };
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
      const { result, duplicateCount } = await collectFullRankingPages(
        page,
        baseUrl,
        itemsPerPage,
        maxPages,
      );
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
