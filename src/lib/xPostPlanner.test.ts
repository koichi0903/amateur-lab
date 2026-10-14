import assert from "node:assert/strict";
import test from "node:test";
import { selectSaleSampleMovieWorks } from "./xPostPlanner";

const sale = (id: number, sample_movie_url = `https://cc3001.dmm.co.jp/sample/${id}.mp4`, sale_end_at: string | null = "2099-12-31T00:00:00.000Z") => ({
  id,
  sample_movie_url,
  is_on_sale: true,
  sale_price: 500,
  sale_end_at,
});

test("sale video supply uses current official HTTPS URLs and excludes expired, posted, or external works", () => {
  const result = selectSaleSampleMovieWorks([
    sale(1),
    sale(2, "http://cc3001.dmm.co.jp/sample/2.mp4"),
    sale(3, "https://media.example.invalid/sample/3.mp4"),
    sale(4, undefined, "2000-01-01T00:00:00.000Z"),
    { ...sale(5), is_on_sale: false },
    sale(6),
  ], new Set([6]));

  assert.deepEqual(result.works.map((work) => work.id), [1]);
  assert.deepEqual({ fetched: result.fetched, activeOfficial: result.activeOfficial, afterPosted: result.afterPosted, selected: result.selected }, {
    fetched: 6,
    activeOfficial: 2,
    afterPosted: 1,
    selected: 1,
  });
});

test("sale video supply limit is applied after source, sale, and posted checks", () => {
  const works = Array.from({ length: 8 }, (_, index) => sale(index + 1));
  const result = selectSaleSampleMovieWorks(works, new Set([1]), 3);

  assert.deepEqual(result.works.map((work) => work.id), [2, 3, 4]);
  assert.equal(result.afterPosted, 7);
  assert.equal(result.selected, 3);
});
