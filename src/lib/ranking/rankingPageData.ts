import { buildInsightsForWorks, type HomePriceInsightWork } from "@/lib/getHomePriceInsights";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";
import { supabase } from "@/lib/supabase";
import { sortTrendingWorks } from "@/lib/trendingRanking";
import type { Work } from "@/types/work";
import { getDiscoveryEntityRankings, type DiscoveryEntityKind, type DiscoveryEntityRankingItem } from "./discoveryEntityRanking";

export type RankingPageData = {
  works: Work[];
  entities: DiscoveryEntityRankingItem[];
  errorMessage: string | null;
  totalItems: number;
};

export async function loadOverallRankingPageData({
  offset,
  pageSize,
  saleOnly,
  sampleOnly,
  maxPrice,
}: {
  offset: number;
  pageSize: number;
  saleOnly: boolean;
  sampleOnly: boolean;
  maxPrice: number | null;
}): Promise<RankingPageData> {
  let rankingQuery = supabase.from("works").select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,sample_movie_url,lowest_price,is_bottom_price,sale_end_at,ranking,realtime_rank,previous_realtime_rank,review_average,review_count,affiliate_url", { count: "exact" }).or(NON_VR_GENRE_OR_FILTER).not("title", "ilike", "%VR%");
  if (saleOnly) rankingQuery = rankingQuery.gt("sale_price", 0);
  if (sampleOnly) rankingQuery = rankingQuery.not("sample_movie_url", "is", null).neq("sample_movie_url", "");
  if (maxPrice) rankingQuery = rankingQuery.or(`and(sale_price.gt.0,sale_price.lte.${maxPrice}),and(sale_price.eq.0,price.lte.${maxPrice})`);

  const result = await rankingQuery.limit(2000);
  const sortedWorks = sortTrendingWorks(((result.data ?? []) as unknown as Work[]).filter(isNonVrWork));
  const works = sortedWorks.slice(offset, offset + pageSize);
  return {
    works,
    entities: [],
    errorMessage: result.error?.message ?? null,
    totalItems: result.count ?? works.length,
  };
}

export async function loadEntityRankingPageData(
  type: DiscoveryEntityKind,
  offset: number,
  pageSize: number,
): Promise<RankingPageData> {
  try {
    const allEntities = await getDiscoveryEntityRankings(type);
    return {
      works: [],
      entities: allEntities.slice(offset, offset + pageSize),
      errorMessage: null,
      totalItems: allEntities.length,
    };
  } catch (error) {
    return {
      works: [],
      entities: [],
      errorMessage: error instanceof Error ? error.message : "ランキングの集計に失敗しました",
      totalItems: 0,
    };
  }
}

export async function loadRankingPageInsights(works: Work[]): Promise<HomePriceInsightWork[]> {
  if (!works.length) return [];
  try {
    return await buildInsightsForWorks(
      works as unknown as HomePriceInsightWork[],
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      { requireBuyTimingSignal: false },
    );
  } catch (error) {
    console.warn("[ranking] price histories are temporarily unavailable", error);
    return [];
  }
}
