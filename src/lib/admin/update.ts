import { supabaseAdmin as supabase } from "../supabaseAdmin";
import type { DmmItem } from "../../types/dmm";
import { formatDmmActresses } from "../dmm/actresses";
import { saveReviewGrowthEvent } from "@/lib/insights/event";

export async function updateDmmItem(
  item: DmmItem,
  currentWork?: {
  id: number;
  review_count: number;
  review_average: number;
  maker: string;
  series: string;
  url: string;
  release_date: string | null;
  actress?: string | null;
},
  options: { updatePrices?: boolean } = {},
) {

const updatePrices = options.updatePrices ?? true;

const previousReviewCount =
  currentWork?.review_count ?? 0;

const currentReviewCount =
  Number(item.review?.count) || 0;

const isReviewGrowth =
  currentReviewCount > previousReviewCount;

const nextMaker =
  item.iteminfo?.maker?.[0]?.name || "";

const nextSeries =
  item.iteminfo?.series?.[0]?.name || "";

const nextUrl =
  item.URL ||
  item.affiliateURL ||
  "";

const nextReleaseDate =
  item.date || null;

const nextReviewAverage =
  Number(item.review?.average) || 0;

const apiCurrentPrice = Number(item.prices?.price) || 0;
const apiListPrice = Number(item.prices?.list_price) || apiCurrentPrice;
const apiSalePrice =
  apiCurrentPrice > 0 && apiListPrice > apiCurrentPrice
    ? apiCurrentPrice
    : 0;
const apiDiscountRate =
  apiSalePrice > 0 && apiListPrice > 0
    ? Math.round((1 - apiSalePrice / apiListPrice) * 100)
    : 0;

const nextActress = formatDmmActresses(item);

const sampleImages =
  item.sampleImageURL?.sample_l?.image ?? [];

const { data: exists } = await supabase
  .from("work_sample_images")
  .select("id")
  .eq("product_id", item.content_id)
  .limit(1)
  .maybeSingle();

const hasChanges =
  currentWork?.review_count !== currentReviewCount ||
  currentWork?.review_average !== nextReviewAverage ||
  currentWork?.maker !== nextMaker ||
  currentWork?.series !== nextSeries ||
  currentWork?.url !== nextUrl ||
  currentWork?.release_date !== nextReleaseDate;
const hasActressChange =
  nextActress != null && currentWork?.actress !== nextActress;

if (!exists && sampleImages.length > 0) {
  const { error: sampleImageError } = await supabase
  .from("work_sample_images")
  .insert(
      sampleImages.map((url, index) => ({
        product_id: item.content_id,
        image_url: url,
        sort_order: index + 1,
      }))
    );

  if (sampleImageError) {
    throw sampleImageError;
  }
}

if (currentWork && !hasChanges && !hasActressChange) {
  return;
}

  const { error } = await supabase
    .from("works")
    .update({
  release_date: nextReleaseDate,

  maker: nextMaker,

  series: nextSeries,

  url: nextUrl || null,

  review_count: currentReviewCount,

  review_average: nextReviewAverage,

  ...(updatePrices && apiCurrentPrice > 0
    ? {
        price: apiListPrice,
        list_price: apiListPrice,
        sale_price: apiSalePrice,
        discount_rate: apiDiscountRate,
      }
    : {}),

  ...(nextActress != null ? { actress: nextActress } : {}),

  last_updated: new Date().toISOString(),
})
    .eq("product_id", item.content_id);

  if (error) {
    throw error;
  }

  if (
  !error &&
  currentWork &&
  isReviewGrowth
) {
  await saveReviewGrowthEvent({
    workId: currentWork.id,
    previousReviewCount,
    currentReviewCount,
  });
}
}
