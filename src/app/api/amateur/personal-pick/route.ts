import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addConfirmedPerformersToAmateurItems, normalizeFanzaAmateurCatalogItem, type FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";
import { buildPersonalPickProfile, rankPersonalPickCandidates } from "@/lib/dmm/fanzaAmateurPersonalPick";

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
  const profile = buildPersonalPickProfile(favoriteItems);
  const candidateResults = await Promise.all([
    ...profile.preferenceTokens.map(({ kind, name }) => supabaseAdmin
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
    if (item && !profile.favoriteIds.has(item.content_id)) candidateRows.set(item.content_id, item);
  }

  const personalPicks = rankPersonalPickCandidates([...candidateRows.values()], profile);

  const enrichedPicks = await addConfirmedPerformersToAmateurItems(personalPicks.map(({ item }) => item));
  const enrichedById = new Map(enrichedPicks.map((item) => [item.content_id, item]));

  return NextResponse.json({ works: favoriteItems, personalPicks: personalPicks.map((pick) => ({ ...pick, item: enrichedById.get(pick.item.content_id) ?? pick.item })) });
}

