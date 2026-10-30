import { supabaseAdmin as supabase } from "../supabaseAdmin";
import type { DmmItem } from "../../types/dmm";
import type { ActressRankingItem, RankingItem } from "../../types/ranking";
import {
  createDmmItemInsertRecord,
  getDmmItemSampleImages,
  scoreDmmItem,
  scoreDmmItemEntities,
  type DmmItemRankingData,
} from "./saveDmmItemData";

async function loadRankingData(rankingData?: DmmItemRankingData): Promise<DmmItemRankingData> {
  if (rankingData) return rankingData;

  const { data: actressRanking } = await supabase
    .from("actress_rankings")
    .select("name,original_rank,fanza_rank");
  const { data: genreRanking } = await supabase
    .from("genre_rankings")
    .select("name,rank,score");
  const { data: makerRanking } = await supabase
    .from("maker_rankings")
    .select("name,rank,score");
  const { data: seriesRanking } = await supabase
    .from("series_rankings")
    .select("name,original_rank,fanza_rank");

  return {
    actressRanking: (actressRanking ?? []) as ActressRankingItem[],
    genreRanking: (genreRanking ?? []) as RankingItem[],
    makerRanking: (makerRanking ?? []) as RankingItem[],
    seriesRanking: (seriesRanking ?? []) as ActressRankingItem[],
  };
}

async function saveSampleImages(contentId: string, sampleImages: string[]) {
  if (!sampleImages.length) return;

  await supabase
    .from("work_sample_images")
    .delete()
    .eq("product_id", contentId);
  await supabase
    .from("work_sample_images")
    .insert(sampleImages.map((url, index) => ({
      product_id: contentId,
      image_url: url,
      sort_order: index + 1,
    })));
}

export async function saveDmmItem(
  item: DmmItem,
  rankingData?: DmmItemRankingData,
  stage: string = "NEW",
) {
  console.log("sampleImageURL =", JSON.stringify(item.sampleImageURL, null, 2));

  const sampleImages = getDmmItemSampleImages(item);
  const rankings = await loadRankingData(rankingData);
  const entityScores = scoreDmmItemEntities(item, rankings);
  const score = scoreDmmItem(item, entityScores, sampleImages.length);

  const { data: existing } = await supabase
    .from("works")
    .select("id")
    .eq("product_id", item.content_id)
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase
    .from("works")
    .insert([createDmmItemInsertRecord(item, stage, entityScores, score)]);
  if (error) {
    console.error("INSERT ERROR", item.content_id, error);
    return false;
  }

  await saveSampleImages(item.content_id, sampleImages);
  console.log("INSERT OK", item.content_id);
  return true;
}
