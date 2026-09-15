import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type XHubWork = {
  id: number;
  title: string;
  actress: string | null;
  genre: string | null;
  image_url: string | null;
  score: number | null;
  price: number | null;
  sale_price: number | null;
  discount_rate: number | null;
  review_average: number | null;
  review_count: number | null;
  release_date: string | null;
};

const HUB_COLUMNS = [
  "id",
  "title",
  "actress",
  "genre",
  "image_url",
  "score",
  "price",
  "sale_price",
  "discount_rate",
  "review_average",
  "review_count",
  "release_date",
].join(",");

export async function getXGrowthHubData(): Promise<{
  recommended: XHubWork[];
  deals: XHubWork[];
  highScore: XHubWork[];
  newest: XHubWork[];
  error: string | null;
}> {
  const [recommendedResult, dealsResult, highScoreResult, newestResult] =
    await Promise.all([
      supabaseAdmin
        .from("works")
        .select(HUB_COLUMNS)
        .gt("score", 0)
        .order("score", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false })
        .limit(8),
      supabaseAdmin
        .from("works")
        .select(HUB_COLUMNS)
        .gt("discount_rate", 0)
        .order("discount_rate", { ascending: false, nullsFirst: false })
        .limit(8),
      supabaseAdmin
        .from("works")
        .select(HUB_COLUMNS)
        .gt("review_average", 0)
        .order("review_average", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false, nullsFirst: false })
        .limit(8),
      supabaseAdmin
        .from("works")
        .select(HUB_COLUMNS)
        .order("release_date", { ascending: false, nullsFirst: false })
        .limit(8),
    ]);

  const errors = [
    recommendedResult.error,
    dealsResult.error,
    highScoreResult.error,
    newestResult.error,
  ]
    .filter(Boolean)
    .map((error) => error?.message);

  return {
    recommended: (recommendedResult.data ?? []) as unknown as XHubWork[],
    deals: (dealsResult.data ?? []) as unknown as XHubWork[],
    highScore: (highScoreResult.data ?? []) as unknown as XHubWork[],
    newest: (newestResult.data ?? []) as unknown as XHubWork[],
    error: errors.length ? errors.join(" / ") : null,
  };
}
