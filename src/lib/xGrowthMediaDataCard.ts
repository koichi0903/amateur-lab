import { parseDatabaseDate } from "./dateTime.ts";

export type XGrowthMediaDataCardWork = {
  title: string;
  actress: string | null;
  genre: string | null;
  ranking: number | null;
  discount_rate: number | null;
  review_average: number | null;
  review_count: number | null;
  sale_price: number | null;
  price: number | null;
  list_price: number | null;
  lowest_price: number | null;
  is_bottom_price: boolean | null;
  is_on_sale: boolean | null;
  sale_end_at: string | null;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function splitText(value: string, limit: number, maxLines: number) {
  const chars = [...value.replace(/\s+/g, " ").trim()];
  const lines: string[] = [];
  let line = "";
  for (const char of chars) {
    line += char;
    if (line.length >= limit) {
      lines.push(line);
      line = "";
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

type DataCardPriceState = {
  saleIsCurrent: boolean;
  currentPrice: number | null;
  regularPrice: number | null;
  discountRate: number | null;
  recordedLow: number | null;
  isRecordedLow: boolean;
  saleEnd: string | null;
};

function formatSaleEnd(saleEndAt: number | null, now: number) {
  return saleEndAt && saleEndAt > now
    ? new Date(saleEndAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" })
    : null;
}

function isCurrentSale(work: XGrowthMediaDataCardWork, saleEndAt: number | null, now: number) {
  return Boolean(work.is_on_sale && work.sale_price && work.sale_price > 0 && (!work.sale_end_at || (saleEndAt != null && saleEndAt > now)));
}

function currentDataCardPrice(work: XGrowthMediaDataCardWork, saleIsCurrent: boolean) {
  return saleIsCurrent ? work.sale_price : work.price;
}

function regularDataCardPrice(work: XGrowthMediaDataCardWork, currentPrice: number | null) {
  return work.list_price && currentPrice && work.list_price > currentPrice ? work.list_price : null;
}

function dataCardDiscountRate(regularPrice: number | null, currentPrice: number | null) {
  return regularPrice && currentPrice ? Math.round((1 - currentPrice / regularPrice) * 100) : null;
}

function recordedDataCardLow(work: XGrowthMediaDataCardWork) {
  return work.lowest_price && work.lowest_price > 0 ? work.lowest_price : null;
}

function isDataCardAtRecordedLow(work: XGrowthMediaDataCardWork, recordedLow: number | null, currentPrice: number | null) {
  return Boolean(work.is_bottom_price && recordedLow && currentPrice === recordedLow);
}

function getDataCardPriceState(work: XGrowthMediaDataCardWork, now: number): DataCardPriceState {
  const saleEndAt = parseDatabaseDate(work.sale_end_at)?.getTime() ?? null;
  const saleIsCurrent = isCurrentSale(work, saleEndAt, now);
  const currentPrice = currentDataCardPrice(work, saleIsCurrent);
  const regularPrice = regularDataCardPrice(work, currentPrice);
  const discountRate = dataCardDiscountRate(regularPrice, currentPrice);
  const recordedLow = recordedDataCardLow(work);
  const isRecordedLow = isDataCardAtRecordedLow(work, recordedLow, currentPrice);
  const saleEnd = work.sale_end_at ? formatSaleEnd(saleEndAt, now) : null;
  return { saleIsCurrent, currentPrice, regularPrice, discountRate, recordedLow, isRecordedLow, saleEnd };
}

function formatDataCardPrice(value: number | null) {
  return value && value > 0 ? `¥${value.toLocaleString("ja-JP")}` : "未取得";
}

function dataCardReviewLabel(work: XGrowthMediaDataCardWork, discountRate: number | null) {
  if (discountRate) return `通常価格から${discountRate}%OFF`;
  if (work.review_average) return `レビュー評価 ${work.review_average.toFixed(1)}（${work.review_count ?? 0}件）`;
  return "価格・記録を作品ページで確認";
}

function dataCardPriceNote(saleEnd: string | null, isRecordedLow: boolean) {
  if (saleEnd) return `セール期限 ${saleEnd}（サイト掲載情報）`;
  if (isRecordedLow) return "価格は発掘LABで記録した範囲の比較です";
  return "価格・セール状況は遷移先でご確認ください";
}

function dataCardActress(work: XGrowthMediaDataCardWork) {
  return work.actress?.split(/[,、/]/)[0]?.trim() || "";
}

function dataCardRecordedLowBadge(isRecordedLow: boolean) {
  return isRecordedLow
    ? `<rect x="865" y="70" width="235" height="54" rx="27" fill="#831843"/><text x="982" y="106" text-anchor="middle" fill="#fff1f2" font-size="24" font-weight="900" font-family="Arial, sans-serif">記録最安と同額</text>`
    : "";
}

function dataCardActressLabel(actress: string) {
  return actress
    ? `<text x="82" y="154" fill="#a1a1aa" font-size="24" font-weight="700" font-family="Arial, sans-serif">${escapeXml(actress)}</text>`
    : "";
}

export function xGrowthMediaDataCard(work: XGrowthMediaDataCardWork, now = Date.now()) {
  const { saleIsCurrent, currentPrice, regularPrice, discountRate, recordedLow, isRecordedLow, saleEnd } = getDataCardPriceState(work, now);
  const actress = dataCardActress(work);
  const titleLines = splitText(work.title, 22, 3);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#09090b"/>
  <rect x="42" y="42" width="1116" height="591" rx="24" fill="#101316" stroke="#ec4899" stroke-width="3"/>
  <text x="82" y="106" fill="#f9a8d4" font-size="28" font-weight="800" font-family="Arial, sans-serif">発掘LAB｜価格をチェック</text>
  ${dataCardRecordedLowBadge(isRecordedLow)}
  ${dataCardActressLabel(actress)}
  ${titleLines.map((line, index) => `<text x="82" y="${202 + index * 40}" fill="#ffffff" font-size="32" font-weight="900" font-family="Arial, sans-serif">${escapeXml(line)}</text>`).join("")}
  <g><rect x="82" y="354" width="318" height="142" rx="18" fill="#18181b" stroke="#3f3f46"/><text x="112" y="397" fill="#a1a1aa" font-size="23" font-weight="700" font-family="Arial, sans-serif">通常価格</text><text x="112" y="463" fill="#f4f4f5" font-size="46" font-weight="900" font-family="Arial, sans-serif">${escapeXml(formatDataCardPrice(regularPrice))}</text></g>
  <g><rect x="440" y="354" width="318" height="142" rx="18" fill="#3b102b" stroke="#ec4899" stroke-width="2"/><text x="470" y="397" fill="#fbcfe8" font-size="23" font-weight="700" font-family="Arial, sans-serif">${saleIsCurrent ? "現在価格" : "掲載価格"}</text><text x="470" y="463" fill="#ffffff" font-size="50" font-weight="900" font-family="Arial, sans-serif">${escapeXml(formatDataCardPrice(currentPrice))}</text></g>
  <g><rect x="798" y="354" width="318" height="142" rx="18" fill="#18181b" stroke="#3f3f46"/><text x="828" y="397" fill="#a1a1aa" font-size="23" font-weight="700" font-family="Arial, sans-serif">発掘LABの記録最安</text><text x="828" y="463" fill="#f4f4f5" font-size="46" font-weight="900" font-family="Arial, sans-serif">${escapeXml(formatDataCardPrice(recordedLow))}</text></g>
  <text x="82" y="550" fill="#f9a8d4" font-size="28" font-weight="800" font-family="Arial, sans-serif">${dataCardReviewLabel(work, discountRate)}</text>
  <text x="82" y="594" fill="#a1a1aa" font-size="21" font-weight="700" font-family="Arial, sans-serif">${dataCardPriceNote(saleEnd, isRecordedLow)}</text>
  <text x="1110" y="594" text-anchor="end" fill="#71717a" font-size="20" font-weight="700" font-family="Arial, sans-serif">@hakkutsu_lab</text>
</svg>`;
}
