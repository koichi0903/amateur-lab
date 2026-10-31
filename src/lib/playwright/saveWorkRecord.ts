import type { ParsedData } from "./parser";
import type { deriveWorkPriceSummary } from "./savePriceData";
import { resolveListPriceToSave } from "./saveListPrice";

export type ExistingWorkRecord = {
  price: number | null;
  list_price: number | null;
  sale_price: number | null;
  lowest_price: number | null;
  discount_rate: number | null;
  max_discount_rate: number | null;
  is_on_sale: boolean | null;
  sale_end_at: string | null;
  playwright_status: string | null;
  stage: string | null;
  is_bottom_price: boolean | null;
  is_lowest_price: boolean | null;
  actress: string | null;
};

type WorkPriceSummary = ReturnType<typeof deriveWorkPriceSummary>;
type WorkRecordInput = Pick<
  ParsedData,
  | "title"
  | "actressLinks"
  | "maker"
  | "series"
  | "label"
  | "releaseDate"
  | "productReleaseDate"
  | "duration"
>;

type WorkRecordUpdate = {
  title: string | undefined;
  actress?: string;
  maker: string | undefined;
  series: string | undefined;
  label: string | undefined;
  release_date: string | undefined;
  product_release_date: string | undefined;
  duration: string | undefined;
  price: number | null;
  list_price?: number | null;
  sale_price: number | null;
  lowest_price: number | null;
  discount_rate: number;
  max_discount_rate: number;
  is_on_sale: boolean;
  sale_end_at: Date | null;
  playwright_status: "SALE" | "NORMAL";
  stage?: string;
  is_bottom_price: boolean;
  is_lowest_price: boolean;
};

function hasPriceFieldsChanged(
  current: ExistingWorkRecord,
  next: WorkRecordUpdate,
) {
  return (
    current.price !== next.price ||
    (next.list_price !== undefined && current.list_price !== next.list_price) ||
    current.sale_price !== next.sale_price ||
    current.discount_rate !== next.discount_rate ||
    current.max_discount_rate !== next.max_discount_rate
  );
}

function hasPriceFlagsChanged(
  current: ExistingWorkRecord,
  next: WorkRecordUpdate,
) {
  const nextSaleEndAt = next.sale_end_at ? next.sale_end_at.toISOString() : null;

  return (
    current.is_on_sale !== next.is_on_sale ||
    (current.sale_end_at ?? null) !== nextSaleEndAt ||
    current.playwright_status !== next.playwright_status ||
    current.is_bottom_price !== next.is_bottom_price ||
    current.is_lowest_price !== next.is_lowest_price ||
    current.lowest_price !== next.lowest_price
  );
}

function hasRestoredFieldsChanged(
  current: ExistingWorkRecord,
  next: WorkRecordUpdate,
) {
  return (
    (next.stage != null && current.stage !== next.stage) ||
    (next.actress != null && current.actress !== next.actress)
  );
}

function deriveLowestPrice(
  current: ExistingWorkRecord | null,
  currentDisplayPrice: number | null,
) {
  if (currentDisplayPrice == null) return current?.lowest_price ?? null;
  if (current?.lowest_price == null) return currentDisplayPrice;
  return Math.min(current.lowest_price, currentDisplayPrice);
}

function isNewLowestPrice(
  current: ExistingWorkRecord | null,
  currentDisplayPrice: number | null,
) {
  return (
    currentDisplayPrice != null &&
    (current?.lowest_price == null || currentDisplayPrice < current.lowest_price)
  );
}

function isLowestPrice(
  current: ExistingWorkRecord | null,
  currentDisplayPrice: number | null,
) {
  return (
    currentDisplayPrice != null &&
    current?.lowest_price != null &&
    (currentDisplayPrice < current.lowest_price ||
      (currentDisplayPrice === current.lowest_price &&
        current.is_lowest_price === true))
  );
}

function deriveWorkPriceState(
  current: ExistingWorkRecord | null,
  summary: WorkPriceSummary,
) {
  const currentDisplayPrice = summary.salePrice ?? summary.price;
  const lowestPrice = deriveLowestPrice(current, currentDisplayPrice);

  return {
    currentDisplayPrice,
    lowestPrice,
    isNewLowestPrice: isNewLowestPrice(current, currentDisplayPrice),
    isLowestPrice: isLowestPrice(current, currentDisplayPrice),
  };
}

function deriveFallbackActress(
  current: ExistingWorkRecord | null,
  data: WorkRecordInput,
) {
  return !current?.actress && data.actressLinks?.length
    ? data.actressLinks.join(" / ")
    : null;
}

function deriveRestoredStage(current: ExistingWorkRecord | null) {
  const discontinuedStageMatch = current?.playwright_status?.match(
    /^DISCONTINUED_[0-9]{8}_(RESERVED|NEW|SEMI_NEW|OLD)$/,
  );
  return current?.stage === "DISCONTINUED"
    ? discontinuedStageMatch?.[1] ?? "OLD"
    : null;
}

function createWorkRecordUpdate(
  data: WorkRecordInput,
  summary: WorkPriceSummary,
  state: ReturnType<typeof deriveWorkPriceState>,
  fallbackActress: string | null,
  listPriceToSave: number | null | undefined,
  restoredStage: string | null,
): WorkRecordUpdate {
  return {
    title: data.title,
    ...(fallbackActress ? { actress: fallbackActress } : {}),
    maker: data.maker,
    series: data.series,
    label: data.label,
    release_date: data.releaseDate,
    product_release_date: data.productReleaseDate,
    duration: data.duration,
    price: summary.price,
    ...(listPriceToSave !== undefined ? { list_price: listPriceToSave } : {}),
    sale_price: summary.salePrice,
    lowest_price: state.lowestPrice,
    discount_rate: summary.discountRate,
    max_discount_rate: summary.maxDiscountRate,
    is_on_sale: summary.isOnSale,
    sale_end_at: summary.saleEndAt,
    playwright_status: summary.isOnSale ? "SALE" : "NORMAL",
    ...(restoredStage ? { stage: restoredStage } : {}),
    is_bottom_price: summary.isBottomPrice,
    is_lowest_price: state.isLowestPrice,
  };
}

function hasWorkRecordChanged(
  current: ExistingWorkRecord | null,
  next: WorkRecordUpdate,
) {
  if (!current) return true;
  return (
    hasPriceFieldsChanged(current, next) ||
    hasPriceFlagsChanged(current, next) ||
    hasRestoredFieldsChanged(current, next)
  );
}

export function buildWorkRecordUpdate(
  current: ExistingWorkRecord | null,
  data: WorkRecordInput,
  summary: WorkPriceSummary,
  listPrice?: number | null,
) {
  const state = deriveWorkPriceState(current, summary);
  const fallbackActress = deriveFallbackActress(current, data);
  const listPriceToSave = resolveListPriceToSave(
    listPrice,
    current?.list_price,
    summary.mainPrice?.normalPrice,
  );
  const restoredStage = deriveRestoredStage(current);
  const workUpdate = createWorkRecordUpdate(
    data,
    summary,
    state,
    fallbackActress,
    listPriceToSave,
    restoredStage,
  );

  return {
    changed: hasWorkRecordChanged(current, workUpdate),
    workUpdate,
    currentDisplayPrice: state.currentDisplayPrice,
    lowestPrice: state.lowestPrice,
    isNewLowestPrice: state.isNewLowestPrice,
  };
}
