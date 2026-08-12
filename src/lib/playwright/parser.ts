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
  actressLinks?: string[];

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

sampleMovieUrl?: string;

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
  try {
    const row = page.locator("tr").filter({
      hasText: label,
    });

    if ((await row.count()) === 0) {
      return undefined;
    }

    const td = row.locator("td").first();

    if ((await td.count()) === 0) {
      return undefined;
    }

    const text = await td.textContent();

    const value = text?.trim();

    if (!value || value === "----") {
      return undefined;
    }

    return value;
  } catch {
    return undefined;
  }
}

async function getTableLinkValues(
  page: Page,
  label: string,
  hrefPart: string
): Promise<string[]> {
  try {
    const row = page.locator("tr").filter({ hasText: label }).first();
    if ((await row.count()) === 0) return [];

    const values = await row
      .locator(`a[href*="${hrefPart}"]`)
      .allTextContents();

    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

async function getDateValue(
  page: Page,
  label: string
): Promise<string | undefined> {
  const value = await getTableValue(page, label);

  if (!value) {
    return undefined;
  }

  // 先頭の日付だけ取得
  const match = value.match(/\d{4}\/\d{2}\/\d{2}/);

  if (!match) {
    return undefined;
  }

  // PostgreSQL DATE用に YYYY-MM-DD に変換
  return match[0].replace(/\//g, "-");
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

  const nameCounts = new Map<string, number>();

  for (const price of result) {
    nameCounts.set(
      price.name,
      (nameCounts.get(price.name) ?? 0) + 1
    );
  }

  // 同じ販売名でも「無期限」「7日間」などが異なる別プランがある。
  // work_prices は display_name を一意キーにしているため、重複時だけ期間を付けて区別する。
  const normalized = result.map((price) =>
    (nameCounts.get(price.name) ?? 0) > 1
      ? {
          ...price,
          name: `${price.name}（${price.period ?? "期間不明"}）`,
        }
      : price
  );

  const normalizedNames = new Set<string>();

  for (const price of normalized) {
    if (normalizedNames.has(price.name)) {
      throw new Error(
        `価格プランを一意に識別できません: ${price.name}`
      );
    }

    normalizedNames.add(price.name);
  }

  return normalized;
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
  actressLinks: await getTableLinkValues(page, "出演者", "actress="),

  actress: await getTableValue(page, "出演者"),
  maker: await getTableValue(page, "メーカー"),

series: await getTableValue(page, "シリーズ"),

label: await getTableValue(page, "レーベル"),

prices,

reviewAverage: undefined,
reviewCount: undefined,

releaseDate: await getDateValue(
  page,
  "配信開始日"
),

productReleaseDate: await getDateValue(
  page,
  "商品発売日"
),

duration: await getTableValue(page, "収録時間"),

sampleImages: [],

saleEndAt,
};
}
