import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdjacentWorkHeroMediaSelection,
  isWorkHeroImageViewerOpen,
} from "./workHeroMediaSelection.ts";

test("moves right from the movie to the first image when images exist", () => {
  assert.equal(getAdjacentWorkHeroMediaSelection("movie", "right", 3), 0);
});

test("moves right through images and returns to the movie at the end", () => {
  assert.equal(getAdjacentWorkHeroMediaSelection(0, "right", 3), 1);
  assert.equal(getAdjacentWorkHeroMediaSelection(2, "right", 3), "movie");
});

test("moves left from the movie to the last image when images exist", () => {
  assert.equal(getAdjacentWorkHeroMediaSelection("movie", "left", 3), 2);
});

test("moves left through images and returns to the movie at the beginning", () => {
  assert.equal(getAdjacentWorkHeroMediaSelection(2, "left", 3), 1);
  assert.equal(getAdjacentWorkHeroMediaSelection(0, "left", 3), "movie");
});

test("keeps the movie selected when no sample images exist", () => {
  assert.equal(getAdjacentWorkHeroMediaSelection("movie", "right", 0), "movie");
  assert.equal(getAdjacentWorkHeroMediaSelection("movie", "left", 0), "movie");
});

test("shows the image viewer only for an open sample image", () => {
  assert.equal(isWorkHeroImageViewerOpen(true, 0), true);
  assert.equal(isWorkHeroImageViewerOpen(false, 0), false);
  assert.equal(isWorkHeroImageViewerOpen(true, "movie"), false);
});
