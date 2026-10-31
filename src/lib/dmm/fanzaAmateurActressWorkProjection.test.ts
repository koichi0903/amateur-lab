import assert from "node:assert/strict";
import test from "node:test";
import type { FanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import { projectFanzaAmateurActressWorkRow } from "./fanzaAmateurActressWorkProjection.ts";

const row = {
  raw_item: { id: "source" },
  fetched_at: "2026-10-29T00:00:00.000Z",
  image_url: { large: "saved-large", small: "", list: "saved-list" },
  sample_image_url: {
    sample_l: { image: ["saved-large-sample", 4] },
    sample_s: { image: ["saved-small-sample"] },
  },
  confirmed_performers: ["confirmed name"],
  total_count: 1,
};

test("uses saved cover and sample images while preserving catalog fallbacks", () => {
  const item = {
    content_id: "content-1",
    imageURL: { large: "catalog-large", small: "catalog-small", list: "catalog-list" },
    sampleImageURL: { sample_l: { image: ["catalog-large-sample"] } },
  } as FanzaAmateurCatalogItem;
  const projected = projectFanzaAmateurActressWorkRow(row, () => item);

  assert.equal(projected?.fetchedAt, row.fetched_at);
  assert.equal(projected?.item.imageURL?.large, "saved-large");
  assert.equal(projected?.item.imageURL?.small, "catalog-small");
  assert.equal(projected?.item.imageURL?.list, "saved-list");
  assert.deepEqual(projected?.item.sampleImageURL?.sample_l?.image, ["saved-large-sample"]);
  assert.deepEqual(projected?.item.sampleImageURL?.sample_s?.image, ["saved-small-sample"]);
  assert.deepEqual(projected?.item.confirmedPerformers, ["confirmed name"]);
});

test("keeps sample fallbacks for empty saved samples and skips invalid catalog items", () => {
  const item = {
    content_id: "content-2",
    sampleImageURL: { sample_l: { image: ["catalog-sample"] } },
  } as FanzaAmateurCatalogItem;
  const projected = projectFanzaAmateurActressWorkRow({ ...row, sample_image_url: null, confirmed_performers: null }, () => item);
  assert.deepEqual(projected?.item.sampleImageURL?.sample_l?.image, ["catalog-sample"]);
  assert.deepEqual(projected?.item.confirmedPerformers, []);
  assert.equal(projectFanzaAmateurActressWorkRow(row, () => null), null);
});
