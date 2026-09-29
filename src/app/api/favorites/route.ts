import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type FavoriteProfileWork = {
  id: number;
  actress: string | null;
  maker: string | null;
  series: string | null;
  genre: string | null;
  price: number | null;
  sale_price: number | null;
};

type PersonalPick = FavoriteProfileWork & {
  title: string;
  image_url: string | null;
  review_average: number | null;
  review_count: number | null;
  discount_rate: number | null;
  affiliate_url: string | null;
  reason: string;
};

function values(value: string | null) {
  return value?.split(" / ").map((item) => item.trim()).filter(Boolean) ?? [];
}

function currentPrice(work: FavoriteProfileWork) {
  return work.sale_price && work.sale_price > 0 ? work.sale_price : work.price ?? 0;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const rawIds = body && typeof body === "object" && "ids" in body ? (body as { ids?: unknown }).ids : null;
  const ids = Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, 200)
    : [];
  if (!ids.length) return NextResponse.json({ works: [], personalPicks: [] });

  const { data, error } = await supabase
    .from("works")
    .select("id,title,image_url,actress,maker,series,genre,price,sale_price,discount_rate,review_average,review_count,affiliate_url")
    .in("id", ids);
  if (error) return NextResponse.json({ works: [], personalPicks: [], error: "作品を取得できませんでした" }, { status: 500 });

  const favorites = (data ?? []) as Array<FavoriteProfileWork & { title: string; image_url: string | null; discount_rate: number | null; review_average: number | null; review_count: number | null; affiliate_url: string | null }>;
  const tokenCounts = new Map<string, number>();
  for (const work of favorites) {
    for (const token of [...values(work.actress), ...values(work.maker), ...values(work.series), ...values(work.genre)]) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }
  const priceValues = favorites.map(currentPrice).filter((price) => price > 0);
  const averagePrice = priceValues.length ? priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length : 0;
  const candidateResult = await supabase
    .from("works")
    .select("id,title,image_url,actress,maker,series,genre,price,sale_price,discount_rate,review_average,review_count,affiliate_url")
    .not("id", "in", `(${ids.join(",")})`)
    .gt("review_average", 0)
    .order("review_average", { ascending: false, nullsFirst: false })
    .limit(160);

  const candidates = (candidateResult.data ?? []) as Array<PersonalPick & { relevance?: number }>;
  const personalPicks = candidates
    .map((work) => {
      const matchedTokens = [...values(work.actress), ...values(work.maker), ...values(work.series), ...values(work.genre)]
        .filter((token) => tokenCounts.has(token))
        .sort((a, b) => (tokenCounts.get(b) ?? 0) - (tokenCounts.get(a) ?? 0));
      const price = currentPrice(work);
      const priceMatch = averagePrice > 0 && price > 0 && Math.abs(price - averagePrice) <= Math.max(500, averagePrice * 0.5);
      const relevance = matchedTokens.reduce((sum, token) => sum + (tokenCounts.get(token) ?? 0) * 10, 0) + (priceMatch ? 3 : 0) + Math.min(3, (work.review_average ?? 0) / 2);
      return { ...work, relevance, matchedTokens, priceMatch };
    })
    .filter((work) => work.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || (b.review_average ?? 0) - (a.review_average ?? 0))
    .slice(0, 6)
    .map((item) => {
      const { relevance, matchedTokens, priceMatch, ...work } = item;
      void relevance;
      return {
        ...work,
        reason: matchedTokens[0] ? `${matchedTokens[0]}が好きなあなたへ` : priceMatch ? "いつもの価格帯から選ぶ一作品" : "高評価レビューから選んだ一作品",
      };
    });

  return NextResponse.json({ works: favorites, personalPicks });
}
