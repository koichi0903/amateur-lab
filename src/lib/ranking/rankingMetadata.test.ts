import assert from "node:assert/strict";
import test from "node:test";
import { resolveRankingMetadata } from "./rankingMetadata.ts";

const types = ["overall", "actress", "genre", "maker"] as const;

test("uses the canonical overall first page by default", () => {
  assert.deepEqual(resolveRankingMetadata({}, types, "overall"), {
    type: "overall",
    page: 1,
    canonical: "/ranking",
    noIndex: false,
  });
});

test("keeps type and page in canonical while excluding filter parameters", () => {
  assert.deepEqual(resolveRankingMetadata({
    type: "actress",
    page: "3",
    sale: "1",
    sample: "1",
    maxPrice: "1200",
  }, types, "overall"), {
    type: "actress",
    page: 3,
    canonical: "/ranking?type=actress&page=3",
    noIndex: true,
  });
});

test("falls back for unknown types and invalid or first-page values", () => {
  assert.deepEqual(resolveRankingMetadata({ type: "toString", page: "0" }, types, "overall"), {
    type: "overall",
    page: 1,
    canonical: "/ranking",
    noIndex: false,
  });
});
