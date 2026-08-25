import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

const fetchHomeRanking = async () => {
  const { data, error } = await supabase
    .from("works")
    .select("id,title,image_url,score,price,sale_price,list_price,discount_rate,sale_end_at")
    .order("score", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data ?? [];
};

export const getHomeRanking = unstable_cache(
  fetchHomeRanking,
  ["home-ranking-v2"],
  { revalidate: 86400, tags: ["home-ranking", "home-catalog"] },
);
