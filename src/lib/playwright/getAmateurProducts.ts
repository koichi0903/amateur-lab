import { createBrowser } from "@/lib/playwright/browserManager";
import { openFanzaPageWithSelector } from "@/lib/playwright/fanzaAgeGate";

export type AmateurProductSummary = {
  productId: string;
  url: string;
};

const AMATEUR_LIST_URL = "https://video.dmm.co.jp/amateur/list/?sort=date";
const AMATEUR_CONTENT_LINK_SELECTOR = 'a[href*="/amateur/content/?id="]';

function absoluteFanzaUrl(href: string) {
  return new URL(href, "https://video.dmm.co.jp").href;
}

function parseProductId(href: string) {
  return new URL(absoluteFanzaUrl(href)).searchParams.get("id");
}

export async function getAmateurProducts(limit = 10) {
  const browser = await createBrowser();
  const page = await browser.newPage();

  try {
    await openFanzaPageWithSelector(
      page,
      AMATEUR_LIST_URL,
      AMATEUR_CONTENT_LINK_SELECTOR,
      { label: "amateur-list", minimumCount: 1 },
    );

    const hrefs = await page
      .locator(AMATEUR_CONTENT_LINK_SELECTOR)
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href") ?? "")
          .filter(Boolean),
      );

    const products = new Map<string, AmateurProductSummary>();

    for (const href of hrefs) {
      const productId = parseProductId(href);
      if (!productId || products.has(productId)) continue;

      products.set(productId, {
        productId,
        url: absoluteFanzaUrl(href),
      });

      if (products.size >= limit) break;
    }

    return [...products.values()];
  } finally {
    await browser.close();
  }
}
