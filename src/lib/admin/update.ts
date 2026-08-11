import { supabase } from "../supabase";
import type { DmmItem } from "../../types/dmm";
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
}
) {

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

if (!exists && sampleImages.length > 0) {
  const { error: imageError } = await supabase
  .from("work_sample_images")
  .insert(
      sampleImages.map((url, index) => ({
        product_id: item.content_id,
        image_url: url,
        sort_order: index + 1,
      }))
    );
}

if (currentWork && !hasChanges) {
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

  last_updated: new Date().toISOString(),
})
    .eq("product_id", item.content_id);

  if (error) {
    console.error(error);
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
