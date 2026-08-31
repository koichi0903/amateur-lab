import { supabase } from "@/lib/supabase";
import type { DealWork } from "@/components/deals/DealWorkCard";
import type { DealCategory } from "@/lib/deals";
import { unstable_cache } from "next/cache";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";

export const DEAL_COLUMNS = [
  "id", "title", "image_url", "price", "sale_price", "list_price",
  "genre", "discount_rate", "score", "review_average", "review_count",
  "sale_end_at", "lowest_price", "is_bottom_price", "sample_movie_url",
].join(",");

async function fetchDeals(category: DealCategory, from: number, to: number) {
  let query = supabase
    .from("works")
    .select(DEAL_COLUMNS, { count: "exact" })
    .or(NON_VR_GENRE_OR_FILTER)
    .not("title", "ilike", "%VR%");

  switch (category) {
    case "ending-soon":
      query = query
        .gt("sale_price", 0)
        .gt("sale_end_at", new Date().toISOString())
        .order("sale_end_at", { ascending: true, nullsFirst: false });
      break;
    case "lowest-price":
      query = query
        .eq("is_bottom_price", true)
        .gt("price", 0)
        .order("discount_rate", { ascending: false, nullsFirst: false });
      break;
    case "under-1000":
      query = query
        .or("and(sale_price.gt.0,sale_price.lte.1000),and(sale_price.eq.0,price.lte.1000)")
        .gt("price", 0)
        .order("sale_price", { ascending: true, nullsFirst: false })
        .order("price", { ascending: true });
      break;
    case "high-rated":
      query = query
        .gt("sale_price", 0)
        .gte("review_average", 4)
        .gte("review_count", 5)
        .order("review_average", { ascending: false })
        .order("review_count", { ascending: false });
      break;
    case "sample-available":
      query = query
        .not("sample_movie_url", "is", null)
        .neq("sample_movie_url", "")
        .order("score", { ascending: false, nullsFirst: false });
      break;
    case "best-discount":
      query = query
        .gt("sale_price", 0)
        .gt("discount_rate", 0)
        .order("discount_rate", { ascending: false })
        .order("score", { ascending: false });
      break;
  }

  const response = await query.range(from, to);
  return {
    works: ((response.data ?? []) as unknown as DealWork[]).filter(isNonVrWork),
    count: response.count ?? 0,
    error: response.error,
  };
}

export async function getDeals(category: DealCategory, from = 0, to = 23) {
  const cachedFetch = unstable_cache(
    () => fetchDeals(category, from, to),
    ["deals-non-vr", category, String(from), String(to)],
    { revalidate: 900, tags: ["deals"] },
  );
  return cachedFetch();
}
