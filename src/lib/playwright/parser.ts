import type { Page } from "playwright";

export interface PriceInfo {
  type: string;

  name: string;

  period?: string;

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

  saleEndAt: Date | null;
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

async function getPrices(
  page: Page
): Promise<PriceInfo[]> {
  const result: PriceInfo[] = [];

  const labels = page.locator("label");

const count = await labels.count();

for (let i = 0; i < count; i++) {
  const label = labels.nth(i);

  const text =
    (await label.innerText()).trim();

    const lines = text
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);

    const prices = lines.filter((v) =>
      v.includes("円")
    );

    if (prices.length === 0) {
      continue;
    }

    const toNumber = (value: string) =>
      Number(value.replace(/[^\d]/g, ""));

    let normalPrice: number | undefined;
    let salePrice: number | undefined;

    if (prices.length >= 2) {
  normalPrice = toNumber(prices[0]);
  salePrice = toNumber(prices[1]);
} else {
  normalPrice = toNumber(prices[0]);
}

    const period = lines.find(
  (v) =>
    v === "無期限" ||
    v.includes("日間")
);

    const name = lines
  .filter(
    (v) =>
      !v.includes("円") &&
      v !== "無期限" &&
      !v.includes("日間")
  )
  .join(" ");

    result.push({
  type: "",
  name,
  period,
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



const saleLocator = page.locator(
  "div.relative.mb-1"
);

let saleText = "";

if (await saleLocator.count()) {
  saleText =
    (await saleLocator
      .first()
      .textContent()) ?? "";
}

const saleMatch = saleText.match(
  /(\d+)月(\d+)日.*?(\d+):(\d+)/
);

let saleEndAt: Date | null = null;

if (saleMatch) {
  const now = new Date();

  saleEndAt = new Date(
    now.getFullYear(),
    Number(saleMatch[1]) - 1,
    Number(saleMatch[2]),
    Number(saleMatch[3]),
    Number(saleMatch[4]),
    0
  );
}

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

saleEndAt,
};
}