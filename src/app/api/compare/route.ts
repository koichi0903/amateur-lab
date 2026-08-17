import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { MAX_COMPARISON_ITEMS } from "@/lib/comparison";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const rawIds = body && typeof body === "object" && "ids" in body
    ? (body as { ids?: unknown }).ids
    : null;
  const ids = Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
      .slice(0, MAX_COMPARISON_ITEMS)
    : [];

  if (!ids.length) return NextResponse.json({ works: [] });

  const { data, error } = await supabase
    .from("works")
    .select("id,title,image_url,actress,genre,maker,series,score,price,sale_price,list_price,discount_rate,review_average,review_count,release_date,sample_movie_url,is_bottom_price,sale_end_at,affiliate_url")
    .in("id", ids);

  if (error) {
    console.error("compare works error", error);
    return NextResponse.json({ works: [], error: "比較作品を取得できませんでした" }, { status: 500 });
  }

  return NextResponse.json({ works: data ?? [] });
}
