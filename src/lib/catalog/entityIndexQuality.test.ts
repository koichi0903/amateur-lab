import assert from "node:assert/strict";
import test from "node:test";
import { GSC_TARGET_ACTRESS_NAMES } from "./actressGsc635Manifest";
import { isEntityIndexable } from "./entityIndexQuality";

test("GSC target actress manifest is exactly 635 unique names", () => {
  assert.equal(GSC_TARGET_ACTRESS_NAMES.size, 635);
});

test("actress pages with enough works and an image are indexable regardless of score", () => {
  assert.equal(
    isEntityIndexable("actress", {
      name: "not-in-fixed-cohort",
      count: 10,
      maxScore: 0,
      imageUrl: "https://example.com/actress.jpg",
    }),
    true,
  );
});

test("actress pages still require enough works and an image", () => {
  const target = [...GSC_TARGET_ACTRESS_NAMES][0];
  for (const summary of [
    { name: target, count: 9, maxScore: 0, imageUrl: "https://example.com/a.jpg" },
    { name: target, count: 10, maxScore: 0, imageUrl: " " },
  ]) {
    assert.equal(isEntityIndexable("actress", summary), false);
  }
});

test("other entity types also ignore scores while retaining their work threshold", () => {
  assert.equal(
    isEntityIndexable("genre", {
      name: "genre",
      count: 10,
      maxScore: 0,
      imageUrl: "https://example.com/genre.jpg",
    }),
    true,
  );
  assert.equal(
    isEntityIndexable("maker", {
      name: "maker",
      count: 4,
      maxScore: 100,
      imageUrl: "https://example.com/maker.jpg",
    }),
    false,
  );
});
