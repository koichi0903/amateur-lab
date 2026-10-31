import { supabaseAdmin as supabase } from "../supabaseAdmin";
import type { DmmItem } from "../../types/dmm";
import { saveReviewGrowthEvent } from "@/lib/insights/event";
import {
  areDmmSampleImagesDifferent,
  createDmmItemUpdateFacts,
  createDmmWorkUpdatePayload,
  needsDmmWorkRowUpdate,
  type CurrentDmmWork,
} from "./updateDmmItemData";

export async function updateDmmItem(
  item: DmmItem,
  currentWork?: CurrentDmmWork,
  options: { updatePrices?: boolean } = {},
): Promise<boolean> {
  const updatePrices = options.updatePrices ?? true;
  const facts = createDmmItemUpdateFacts(item, currentWork);

  const { data: existingSampleImages, error: sampleImagesError } = await supabase
    .from("work_sample_images")
    .select("image_url,sort_order")
    .eq("product_id", item.content_id)
    .order("sort_order", { ascending: true });
  if (sampleImagesError) throw sampleImagesError;

  const sampleImagesChanged = areDmmSampleImagesDifferent(existingSampleImages, facts.sampleImages);
  if (sampleImagesChanged) {
    const { error: deleteSampleImagesError } = await supabase
      .from("work_sample_images")
      .delete()
      .eq("product_id", item.content_id);
    if (deleteSampleImagesError) throw deleteSampleImagesError;

    const { error: sampleImageError } = await supabase
      .from("work_sample_images")
      .insert(facts.sampleImages.map((url, index) => ({
        product_id: item.content_id,
        image_url: url,
        sort_order: index + 1,
      })));
    if (sampleImageError) throw sampleImageError;
  }

  if (!needsDmmWorkRowUpdate(currentWork, facts)) return sampleImagesChanged;

  const { error } = await supabase
    .from("works")
    .update(createDmmWorkUpdatePayload(facts, updatePrices, new Date().toISOString()))
    .eq("product_id", item.content_id);
  if (error) throw error;

  if (currentWork && facts.isReviewGrowth) {
    await saveReviewGrowthEvent({
      workId: currentWork.id,
      previousReviewCount: facts.previousReviewCount,
      currentReviewCount: facts.currentReviewCount,
    });
  }

  return true;
}
