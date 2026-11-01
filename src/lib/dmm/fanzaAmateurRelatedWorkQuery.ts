import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";

function uniqueNames(values: Array<{ name: string }> | undefined) {
  return [...new Set((values ?? []).map(({ name }) => String(name ?? "").trim()).filter(Boolean))];
}

export function buildFanzaAmateurRelatedWorkQueryArgs(item: FanzaAmateurCatalogItem) {
  const genres = uniqueNames(item.iteminfo?.genre);
  const makers = uniqueNames(item.iteminfo?.maker);
  const series = uniqueNames(item.iteminfo?.series);
  return {
    genres,
    makers,
    series,
    p_series_names: series.slice(0, 3),
    p_genre_names: genres.slice(0, 6),
    p_maker_names: makers.slice(0, 3),
  };
}
