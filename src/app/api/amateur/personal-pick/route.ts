import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addConfirmedPerformersToAmateurItems, normalizeFanzaAmateurCatalogItem, type FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";

function names(values: Array<{ name: string }> | undefined) {
  return [...new Set((values ?? []).map(({ name }) => name.trim()).filter(Boolean))];
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const rawIds = body && typeof body === "object" && "ids" in body ? (body as { ids?: unknown }).ids : null;
  const ids = Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))].slice(0, 200)
    : [];
  if (!ids.length) return NextResponse.json({ works: [], personalPicks: [] });

  const favoriteResult = await supabaseAdmin
    .from("fanza_amateur_works")
    .select("content_id,raw_item")
    .in("content_id", ids);
  if (favoriteResult.error) return NextResponse.json({ works: [], personalPicks: [], error: "お気に入り作品を読み込めませんでした" }, { status: 500 });

  const favoriteItems = (favoriteResult.data ?? []).flatMap((row) => {
    const item = normalizeFanzaAmateurCatalogItem(row.raw_item);
    return item ? [item] : [];
  });
  const favoriteIds = new Set(favoriteItems.map((item) => item.content_id));
  const tokenCounts = new Map<string, { kind: "maker" | "series" | "genre"; name: string; count: number }>();
  for (const item of favoriteItems) {
    const groups = [
      { kind: "maker" as const, values: names(item.iteminfo?.maker) },
      { kind: "series" as const, values: names(item.iteminfo?.series) },
      { kind: "genre" as const, values: names(item.iteminfo?.genre) },
    ];
    for (const { kind, values } of groups) {
      for (const name of values) {
        const key = `${kind}:${name}`;
        const current = tokenCounts.get(key);
        tokenCounts.set(key, { kind, name, count: (current?.count ?? 0) + 1 });
      }
    }
  }
  const priceValues = favoriteItems.map((item) => item.currentPrice ?? 0).filter((price) => price > 0);
  const averagePrice = priceValues.length ? priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length : 0;

  const preferenceTokens = [...tokenCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const candidateResults = await Promise.all([
    ...preferenceTokens.map(({ kind, name }) => supabaseAdmin
      .from("fanza_amateur_works")
      .select("raw_item")
      .contains("iteminfo", { [kind]: [{ name }] })
      .order("api_date", { ascending: false, nullsFirst: false })
      .limit(100)),
    supabaseAdmin
      .from("fanza_amateur_works")
      .select("raw_item")
      .not("review", "is", null)
      .order("api_date", { ascending: false, nullsFirst: false })
      .limit(160),
  ]);
  if (candidateResults.some(({ error }) => error)) return NextResponse.json({ works: favoriteItems, personalPicks: [], error: "おすすめ作品を読み込めませんでした" }, { status: 500 });

  const candidateRows = new Map<string, FanzaAmateurCatalogItem>();
  for (const row of candidateResults.flatMap(({ data }) => data ?? [])) {
    const item = normalizeFanzaAmateurCatalogItem(row.raw_item);
    if (item && !favoriteIds.has(item.content_id)) candidateRows.set(item.content_id, item);
  }

  const personalPicks = [...candidateRows.values()]
    .flatMap((item) => {
      const matchedTokens = [
        ...names(item.iteminfo?.maker).map((name) => `maker:${name}`),
        ...names(item.iteminfo?.series).map((name) => `series:${name}`),
        ...names(item.iteminfo?.genre).map((name) => `genre:${name}`),
      ]
        .filter((token) => tokenCounts.has(token))
        .map((token) => tokenCounts.get(token)!)
        .sort((a, b) => b.count - a.count);
      const price = item.currentPrice ?? 0;
      const priceMatch = averagePrice > 0 && price > 0 && Math.abs(price - averagePrice) <= Math.max(500, averagePrice * 0.5);
      const rating = item.reviewAverage ?? 0;
      const relevance = matchedTokens.reduce((sum, token) => sum + token.count * 10, 0)
        + (priceMatch ? 3 : 0)
        + (item.review?.count && rating > 0 ? Math.max(0, Math.min(5, rating)) * 2 : 0);
      if (relevance <= 0) return [];
      return [{ item, relevance, matchedTokens, priceMatch }];
    })
    .sort((a, b) => b.relevance - a.relevance || (b.item.reviewAverage ?? 0) - (a.item.reviewAverage ?? 0))
    .slice(0, 6)
    .map(({ item, matchedTokens, priceMatch }) => ({
      item,
      reason: matchedTokens[0] ? `${matchedTokens[0].name}が好きなあなたへ` : priceMatch ? "いつもの価格帯から選んだ一作品" : "高評価レビューから選んだ一作品",
    }));

  const enrichedPicks = await addConfirmedPerformersToAmateurItems(personalPicks.map(({ item }) => item));
  const enrichedById = new Map(enrichedPicks.map((item) => [item.content_id, item]));

  return NextResponse.json({ works: favoriteItems, personalPicks: personalPicks.map((pick) => ({ ...pick, item: enrichedById.get(pick.item.content_id) ?? pick.item })) });
}

