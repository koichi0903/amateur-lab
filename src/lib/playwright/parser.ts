import type { Page } from "playwright";

export interface PriceInfo {
  type: string;

  name: string;

  normalPrice?: number;

  salePrice?: number;
}

export interface ParsedData {
  title?: string;
  description?: string;
  ogImage?: string;
  ogUrl?: string;

  actress?: string;

  maker?: string;
  series?: string;
  label?: string;

  prices: PriceInfo[];
  salePrice?: number;

  reviewAverage?: number;
  reviewCount?: number;

  releaseDate?: string;
  productReleaseDate?: string;

  duration?: string;

  sampleImages: string[];
}

async function getMeta(
  page: Page,
  property: string
): Promise<string | undefined> {
  try {
    const locator = page.locator(
      `meta[property="${property}"]`
    );

    if ((await locator.count()) === 0) {
      return undefined;
    }

    return (
      (await locator.getAttribute("content")) ??
      undefined
    );
  } catch {
    return undefined;
  }
}

async function getTableValue(
  page: Page,
  label: string
): Promise<string | undefined> {
  const row = page.locator("tr").filter({
    hasText: label,
  });

  const td = row.locator("td").first();

  const text = await td.textContent();

  const value = text?.trim();

if (!value || value === "----") {
  return undefined;
}

return value;
}

async function getMaker(
  page: Page
): Promise<string | undefined> {
  return await getTableValue(page, "メーカー");
}

async function getPrices(page: Page): Promise<PriceInfo[]> {
  const result: PriceInfo[] = [];

  const labels = page.locator("label");

  const count = await labels.count();

  const toNumber = (text?: string | null) => {
    if (!text) return undefined;

    const value = text.replace(/[^\d]/g, "");

    return value ? Number(value) : undefined;
  };

  for (let i = 0; i < count; i++) {
    const label = labels.nth(i);

    const texts = (await label.locator("p").allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);

    if (texts.length < 2) continue;

    const name = texts[0];

    const prices = texts.filter((t) => t.includes("円"));

    if (prices.length === 0) continue;

    const normalPrice =
      prices.length >= 2 ? toNumber(prices[0]) : undefined;

    const salePrice =
      prices.length >= 2
        ? toNumber(prices[1])
        : toNumber(prices[0]);

    result.push({
      type: "",
      name,
      normalPrice,
      salePrice,
    });
  }

  return result;
}

export async function parsePage(
  page: Page
): Promise<ParsedData> {

const prices = await getPrices(page);

console.log(prices);

  return {
  title: await getMeta(page, "og:title"),
  description: await getMeta(page, "og:description"),
  ogImage: await getMeta(page, "og:image"),
  ogUrl: await getMeta(page, "og:url"),

  actress: await getTableValue(page, "出演者"),
  maker: await getTableValue(page, "メーカー"),

series: await getTableValue(page, "シリーズ"),

label: await getTableValue(page, "レーベル"),

prices,

reviewAverage: undefined,
reviewCount: undefined,

releaseDate: await getTableValue(page, "配信開始日"),

productReleaseDate: await getTableValue(page, "商品発売日"),

duration: await getTableValue(page, "収録時間"),

sampleImages: [],
};
}