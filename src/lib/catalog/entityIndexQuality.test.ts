import assert from "node:assert/strict";
import test from "node:test";
import { isEntityIndexable } from "./entityIndexQuality";

test("an actress with one work and a representative work image is indexable", () => {
  assert.equal(
    isEntityIndexable("actress", {
      name: "one-work-actress",
      count: 1,
      maxScore: 0,
      imageUrl: "https://example.com/work.jpg",
    }),
    true,
  );
});

test("actresses with no works or no available image remain noindex", () => {
  assert.equal(
    isEntityIndexable("actress", {
      name: "no-work-actress",
      count: 0,
      maxScore: 100,
      imageUrl: "https://example.com/work.jpg",
    }),
    false,
  );
  assert.equal(
    isEntityIndexable("actress", {
      name: "missing-image-actress",
      count: 1,
      maxScore: 100,
      imageUrl: null,
    }),
    false,
  );
});

test("genre, maker, and series work thresholds are unchanged", () => {
  const summary = {
    name: "entity",
    count: 1,
    maxScore: 0,
    imageUrl: "https://example.com/image.jpg",
  };
  assert.equal(isEntityIndexable("genre", { ...summary, count: 9 }), false);
  assert.equal(isEntityIndexable("genre", { ...summary, count: 10 }), true);
  assert.equal(isEntityIndexable("maker", { ...summary, count: 4 }), false);
  assert.equal(isEntityIndexable("maker", { ...summary, count: 5 }), true);
  assert.equal(isEntityIndexable("series", { ...summary, count: 4 }), false);
  assert.equal(isEntityIndexable("series", { ...summary, count: 5 }), true);
});
