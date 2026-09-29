import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";
import { sortTrendingWorks } from "@/lib/trendingRanking";

const fetchHomeRanking = async () => {
  const { data, error } = await supabase
    .from("works")
    .select("id,product_id,title,image_url,actress,genre,maker,series,price,sale_price,list_price,discount_rate,sale_end_at,review_average,review_count,release_date,ranking,realtime_rank,previous_realtime_rank,affiliate_url,is_on_sale")
    .or(NON_VR_GENRE_OR_FILTER)
    .not("title", "ilike", "%VR%")
    .limit(2000);

  if (error) throw error;
  return sortTrendingWorks((data ?? []).filter(isNonVrWork)).slice(0, 12);
};

export const getHomeRanking = unstable_cache(
  fetchHomeRanking,
  ["home-ranking-v6-realtime-rank"],
  { revalidate: 86400, tags: ["home-ranking", "home-catalog"] },
);
