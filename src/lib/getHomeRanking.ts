import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { sortByRevenuePotential } from "@/lib/revenueWeightedWorks";

const fetchHomeRanking = async () => {
  const { data, error } = await supabase
    .from("works")
    .select("id,title,image_url,score,price,sale_price,list_price,discount_rate,sale_end_at")
    .order("score", { ascending: false })
    .limit(40);

  if (error) throw error;
  return sortByRevenuePotential(data ?? [], { limit: 10 });
};

export const getHomeRanking = unstable_cache(
  fetchHomeRanking,
  ["home-ranking-v3-revenue-weighted"],
  { revalidate: 86400, tags: ["home-ranking", "home-catalog"] },
);
