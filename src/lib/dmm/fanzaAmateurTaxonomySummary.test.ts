import assert from "node:assert/strict";
import {
  addFanzaAmateurTaxonomyRows,
  type FanzaAmateurTaxonomySummary,
} from "./fanzaAmateurTaxonomySummary";

const summaries = new Map<string, FanzaAmateurTaxonomySummary>();
addFanzaAmateurTaxonomyRows(summaries, [
  {
    content_id: "one",
    image_url: { large: "https://img.example/one.jpg" },
    iteminfo: { genre: [{ name: "ドラマ" }, { name: "素人" }] },
  },
  {
    content_id: "two",
    image_url: { large: "https://img.example/one.jpg", small: "https://img.example/two.jpg" },
    iteminfo: { genre: [{ name: "ドラマ" }] },
  },
], "genre");

assert.equal(summaries.get("ドラマ")?.count, 2);
assert.equal(summaries.get("ドラマ")?.imageUrl, "https://img.example/one.jpg");
assert.deepEqual(summaries.get("ドラマ")?.imageCandidates, [
  { contentId: "one", imageUrl: "https://img.example/one.jpg" },
]);
assert.equal(summaries.get("素人")?.count, 1);

const makerSummaries = new Map<string, FanzaAmateurTaxonomySummary>();
addFanzaAmateurTaxonomyRows(makerSummaries, [{
  content_id: "maker-work",
  image_url: { small: "https://img.example/maker.jpg" },
  iteminfo: { maker: [{ name: "メーカーA" }] },
}], "maker");
assert.equal(makerSummaries.get("メーカーA")?.imageUrl, "https://img.example/maker.jpg");
assert.deepEqual(makerSummaries.get("メーカーA")?.imageCandidates, []);
