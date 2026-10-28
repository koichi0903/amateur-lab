import assert from "node:assert/strict";
import test from "node:test";
import { GSC_TARGET_ACTRESS_NAMES } from "./actressGsc635Manifest";
import { isEntityIndexable } from "./entityIndexQuality";

test("GSC target actress manifest is exactly 635 unique names", () => {
  assert.equal(GSC_TARGET_ACTRESS_NAMES.size, 635);
});

test("fixed target actresses remain indexable below the volatile score threshold", () => {
  for (const name of GSC_TARGET_ACTRESS_NAMES) {
    assert.equal(
      isEntityIndexable("actress", {
        name,
        count: 10,
        maxScore: 53,
        imageUrl: "https://example.com/actress.jpg",
      }),
      true,
      `${name} should stay indexable below the volatile score threshold`,
    );
  }
});

test("fixed target actresses still require enough works and an image", () => {
  const target = [...GSC_TARGET_ACTRESS_NAMES][0];
  for (const summary of [
    { name: target, count: 9, maxScore: 100, imageUrl: "https://example.com/a.jpg" },
    { name: target, count: 10, maxScore: 100, imageUrl: " " },
  ]) {
    assert.equal(isEntityIndexable("actress", summary), false);
  }
});

test("non-target actresses and other entity types retain existing score thresholds", () => {
  assert.equal(
    isEntityIndexable("actress", {
      name: "not-in-fixed-cohort",
      count: 10,
      maxScore: 59,
      imageUrl: "https://example.com/actress.jpg",
    }),
    false,
  );
  assert.equal(
    isEntityIndexable("genre", {
      name: "genre",
      count: 10,
      maxScore: 59,
      imageUrl: "https://example.com/genre.jpg",
    }),
    false,
  );
});
