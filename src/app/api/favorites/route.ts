import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const rawIds = body && typeof body === "object" && "ids" in body ? (body as { ids?: unknown }).ids : null;
  const ids = Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, 200)
    : [];
  if (!ids.length) return NextResponse.json({ works: [] });

  const { data, error } = await supabase
    .from("works")
    .select("id,title,image_url,actress,maker,score,price,sale_price,discount_rate")
    .in("id", ids);
  if (error) return NextResponse.json({ works: [], error: "作品を取得できませんでした" }, { status: 500 });
  return NextResponse.json({ works: data ?? [] });
}
