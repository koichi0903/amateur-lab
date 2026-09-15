import type { Page } from "playwright-core";

export interface PriceInfo {
  type: string;

  name: string;

  period?: string | null;

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

export function parseCurrencyAmount(text: string): number | null {
  const normalized = text.replace(/\s+/g, "").trim();
  const match = normalized.match(/^(?:[￥¥])?([\d,]+)円?$/);

  // Bare digits can be part of a format name, such as "8KVR".
  if (!match || !/[￥¥円]/.test(normalized)) return null;

  const value = Number(match[1].replace(/,/g, ""));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function normalizePricePeriod(text?: string | null): string | null {
  const normalized = text?.replace(/\s+/g, "").trim();
  if (!normalized) return null;
  if (normalized === "無期限") return normalized;

  const days = normalized.match(/^(\d+)日(?:間)?$/)?.[1];
  return days ? `${days}日間` : null;
}

export function parsePriceOptionFields(input: {
  name: string;
  period?: string | null;
  priceTexts: string[];
}): PriceInfo | null {
  const name = input.name
    .replace(/\s+/g, " ")
    .replace(/\s*＋\s*/g, " ＋ ")
    .trim();
  const period = normalizePricePeriod(input.period);
  const amounts = input.priceTexts
    .map(parseCurrencyAmount)
    .filter((value): value is number => value != null);

  if (!name || amounts.length === 0) return null;

  const normalPrice = amounts[0];
  const candidateSalePrice = amounts[1];
  const salePrice =
    candidateSalePrice != null && candidateSalePrice < normalPrice
      ? candidateSalePrice
      : undefined;

  return { type: "", name, period, normalPrice, salePrice };
}

async function getStructuredPrices(page: Page): Promise<PriceInfo[]> {
  const optionFields = await page.locator("label").evaluateAll((labels) =>
    labels.map((label) => {
      const paragraphs = Array.from(label.querySelectorAll("p"));
      const name = paragraphs.find(
        (paragraph) =>
          paragraph.classList.contains("text-gray-800") &&
          paragraph.classList.contains("text-xs"),
      );
      const period = paragraphs.find((paragraph) =>
        paragraph.classList.contains("text-xxs"),
      );
      const priceTexts = paragraphs
        .map((paragraph) => paragraph.textContent?.trim() ?? "")
        .filter((text) => /[￥¥円]/.test(text));

      return {
        name: name?.textContent ?? "",
        period: period?.textContent ?? null,
        priceTexts,
      };
    }),
  );

  const prices = optionFields
    .map(parsePriceOptionFields)
    .filter((price): price is PriceInfo => price != null);
  const keys = new Set<string>();

  for (const price of prices) {
    const key = `${price.name}\u0000${price.period ?? ""}`;
    if (keys.has(key)) {
      throw new Error(
        `価格プランを一意に識別できません: ${price.name} (${price.period ?? "期間なし"})`,
      );
    }
    keys.add(key);
  }

  return prices;
}

export async function parsePage(
  page: Page
): Promise<ParsedData> {

  
const prices = await getStructuredPrices(page);



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
