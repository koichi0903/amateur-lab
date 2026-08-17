import type { DealWork } from "@/components/deals/DealWorkCard";
import type { FeatureCategory } from "@/lib/features";
import { DEAL_COLUMNS } from "@/lib/getDeals";
import { supabase } from "@/lib/supabase";

export async function getFeatureWorks(category: FeatureCategory, from = 0, to = 29) {
  let query = supabase.from("works").select(`${DEAL_COLUMNS},actress,ranking`, { count: "exact" });

  switch (category) {
    case "beginners":
      query = query.not("sample_movie_url", "is", null).neq("sample_movie_url", "").gte("review_average", 4).gte("review_count", 5).order("score", { ascending: false });
      break;
    case "under-500":
      query = query.or("and(sale_price.gt.0,sale_price.lte.500),and(sale_price.eq.0,price.lte.500)").gt("price", 0).order("score", { ascending: false });
      break;
    case "trusted-reviews":
      query = query.gte("review_average", 4).gte("review_count", 20).order("review_average", { ascending: false }).order("review_count", { ascending: false });
      break;
    case "actress-discovery":
      query = query.not("actress", "is", null).neq("actress", "").order("score", { ascending: false });
      break;
    case "hidden-gems":
      query = query.gte("review_average", 4).gte("score", 70).or("ranking.is.null,ranking.gt.100").order("score", { ascending: false });
      break;
  }

  const response = await query.range(from, to);
  return { works: (response.data ?? []) as unknown as DealWork[], count: response.count ?? 0, error: response.error };
}
