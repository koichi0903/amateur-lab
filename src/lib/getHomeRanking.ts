import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { sortByRevenuePotential } from "@/lib/revenueWeightedWorks";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";

const fetchHomeRanking = async () => {
  const { data, error } = await supabase
    .from("works")
    .select("id,title,image_url,genre,score,price,sale_price,list_price,discount_rate,sale_end_at")
    .or(NON_VR_GENRE_OR_FILTER)
    .not("title", "ilike", "%VR%")
    .order("score", { ascending: false })
    .limit(120);

  if (error) throw error;
  return sortByRevenuePotential((data ?? []).filter(isNonVrWork), { limit: 10 });
};

export const getHomeRanking = unstable_cache(
  fetchHomeRanking,
  ["home-ranking-v4-non-vr-revenue-weighted"],
  { revalidate: 86400, tags: ["home-ranking", "home-catalog"] },
);
