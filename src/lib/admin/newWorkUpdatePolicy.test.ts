import assert from "node:assert/strict";
import test from "node:test";
import { shouldSkipUnchangedNewWorkUpdate } from "./newWorkUpdatePolicy.ts";

const matchingPrices = {
  playwrightStatus: "NORMAL",
  databasePrice: 1200,
  latestPrice: 1200,
  captureSampleMovie: false,
} as const;

test("skips a normal new work when price matches and sample capture is not due", () => {
  assert.equal(shouldSkipUnchangedNewWorkUpdate(matchingPrices), true);
});

test("keeps pending and unavailable works eligible even when the price matches", () => {
  assert.equal(shouldSkipUnchangedNewWorkUpdate({ ...matchingPrices, playwrightStatus: "PENDING" }), false);
  assert.equal(shouldSkipUnchangedNewWorkUpdate({ ...matchingPrices, playwrightStatus: "UNAVAILABLE_1_20261030_OLD" }), false);
});

test("updates when price is missing or changed, or a sample movie capture is due", () => {
  assert.equal(shouldSkipUnchangedNewWorkUpdate({ ...matchingPrices, databasePrice: null }), false);
  assert.equal(shouldSkipUnchangedNewWorkUpdate({ ...matchingPrices, latestPrice: null }), false);
  assert.equal(shouldSkipUnchangedNewWorkUpdate({ ...matchingPrices, latestPrice: 1300 }), false);
  assert.equal(shouldSkipUnchangedNewWorkUpdate({ ...matchingPrices, captureSampleMovie: true }), false);
});
