import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaContentListPage } from "@/lib/playwright/fanzaAgeGate";
import { loadFanzaListPageWithRetry } from "@/lib/playwright/fanzaListRetry";
import type { Locator, Page } from "playwright-core";
import {
  parseFanzaPrices,
  parseFanzaProductId,
  parseFanzaTotalPages,
  type ProductSummary,
} from "./getProductIdsParsing";

export type { ProductSummary } from "./getProductIdsParsing";

async function readProductFromCard(card: Locator): Promise<ProductSummary | null> {
  const link = card.locator('a[href*="/content/?id="]').first();
  const href = await link.getAttribute("href");
  if (!href) return null;

  const productId = parseFanzaProductId(href);
  if (!productId) return null;

  const priceLocator = card.locator('[data-e2eid="content-price"]');
  const priceText =
    (await priceLocator.count()) > 0
      ? (await priceLocator.first().textContent()) ?? ""
      : "";
  const prices = parseFanzaPrices(priceText);

  return { productId, url: href, ...prices };
}

async function collectProductCards(
  page: Page,
  currentPage: number,
  products: Map<string, ProductSummary>,
) {
  const cards = page.locator('[data-e2eid="content-card"]');
  const count = await cards.count();
  console.log(`page ${currentPage}: cards=${count}`);

  for (let index = 0; index < count; index++) {
    const product = await readProductFromCard(cards.nth(index));
    if (product) products.set(product.productId, product);
  }
}

export async function getProductIds(
  baseUrl: string,
  maxPages?: number,
  options: {
    pageRetry?: {
      attempts?: number;
      timeoutMs?: number;
      backoffMs?: readonly number[];
    };
  } = {},
) {
  const browser = await createBrowser({ headless: false });

  let page = await browser.newPage();

  const pageRetry = options.pageRetry;
  const loadPage = async (url: string, pageNumber: number) => {
    if (!pageRetry) {
      await openFanzaContentListPage(page, url);
      return;
    }

    await loadFanzaListPageWithRetry({
      attempts: pageRetry.attempts ?? 3,
      backoffMs: pageRetry.backoffMs ?? [2_000, 6_000],
      pageNumber,
      url,
      load: () =>
        openFanzaContentListPage(page, url, {
          attempts: 1,
          timeoutMs: pageRetry.timeoutMs ?? 30_000,
        }).then(() => undefined),
      recover: async (attempt) => {
        console.warn(
          `[fanza-list] page state recovery page=${pageNumber} after attempt=${attempt}: creating a new page`,
        );
        await page.close().catch(() => undefined);
        page = await browser.newPage();
      },
    });
  };

  try {
    await loadPage(baseUrl, 1);

    // 総ページ数取得
    const pageText =
      (await page
        .locator("text=/全\\d+ページ中/")
        .first()
        .textContent()) ?? "";

    const totalPages = parseFanzaTotalPages(pageText);

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
        await loadPage(`${baseUrl}&page=${currentPage}`, currentPage);
      }

      await collectProductCards(page, currentPage, products);
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
