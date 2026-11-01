import assert from "node:assert/strict";
import test from "node:test";
import type { FanzaAmateurCatalogItem } from "./fanzaAmateurCatalog";
import { buildFanzaAmateurRelatedWorkQueryArgs } from "./fanzaAmateurRelatedWorkQuery";

const named = (names: string[]) => names.map((name) => ({ name }));

test("related-work RPC arguments deduplicate names and preserve per-kind limits", () => {
  const item = {
    iteminfo: {
      series: named([" Series A ", "Series A", "Series B", "Series C", "Series D"]),
      genre: named(["Genre 1", "Genre 2", "Genre 3", "Genre 4", "Genre 5", "Genre 6", "Genre 7"]),
      maker: named(["Maker 1", "Maker 2", "Maker 3", "Maker 4"]),
    },
  } as unknown as FanzaAmateurCatalogItem;

  assert.deepEqual(buildFanzaAmateurRelatedWorkQueryArgs(item), {
    genres: ["Genre 1", "Genre 2", "Genre 3", "Genre 4", "Genre 5", "Genre 6", "Genre 7"],
    makers: ["Maker 1", "Maker 2", "Maker 3", "Maker 4"],
    series: ["Series A", "Series B", "Series C", "Series D"],
    p_series_names: ["Series A", "Series B", "Series C"],
    p_genre_names: ["Genre 1", "Genre 2", "Genre 3", "Genre 4", "Genre 5", "Genre 6"],
    p_maker_names: ["Maker 1", "Maker 2", "Maker 3"],
  });
});
