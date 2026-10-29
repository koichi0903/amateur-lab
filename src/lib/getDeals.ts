import { supabase } from "@/lib/supabase";
import type { DealWork } from "@/components/deals/DealWorkCard";
import type { DealCategory } from "@/lib/deals";
import { unstable_cache } from "next/cache";
import { NON_VR_GENRE_OR_FILTER, isNonVrWork } from "@/lib/vr";

export const DEAL_COLUMNS = [
  "id", "title", "image_url", "price", "sale_price", "list_price",
  "genre", "discount_rate", "review_average", "review_count",
  "sale_end_at", "lowest_price", "is_lowest_price", "is_on_sale", "sample_movie_url",
].join(",");

async function fetchDeals(category: DealCategory, from: number, to: number) {
  if (category === "under-1000") {
    const upper = to + 1;
    const baseQuery = () => supabase
      .from("works")
      .select(DEAL_COLUMNS, { count: "exact" })
      .or(NON_VR_GENRE_OR_FILTER)
      .not("title", "ilike", "%VR%");
    const [sale, regular] = await Promise.all([
      baseQuery().gt("sale_price", 0).lte("sale_price", 1000).gt("price", 0).order("sale_price", { ascending: true }).limit(upper),
      baseQuery().or("sale_price.is.null,sale_price.eq.0").gt("price", 0).lte("price", 1000).order("price", { ascending: true }).limit(upper),
    ]);
    if (sale.error || regular.error) {
      throw new Error("Failed to load deal works.");
    }
    const works = [
      ...((sale.data ?? []) as unknown as DealWork[]),
      ...((regular.data ?? []) as unknown as DealWork[]),
    ]
      .filter(isNonVrWork)
      .sort((a, b) => {
        const aPrice = a.sale_price > 0 ? a.sale_price : a.price;
        const bPrice = b.sale_price > 0 ? b.sale_price : b.price;
        return aPrice - bPrice || String(a.id).localeCompare(String(b.id));
      })
      .slice(from, to + 1);
    return {
      works,
      count: (sale.count ?? 0) + (regular.count ?? 0),
      error: sale.error ?? regular.error,
    };
  }

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
        .eq("is_lowest_price", true)
        .gt("price", 0)
        .order("discount_rate", { ascending: false, nullsFirst: false });
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
        .order("review_average", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false });
      break;
    case "best-discount":
      query = query
        .gt("sale_price", 0)
        .gt("discount_rate", 0)
        .order("discount_rate", { ascending: false })
        .order("review_average", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false });
      break;
  }

  const response = await query.range(from, to);
  if (response.error) {
    throw new Error("Failed to load deal works.");
  }
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
