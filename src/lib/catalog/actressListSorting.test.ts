import assert from "node:assert/strict";
import test from "node:test";
import type { ActressProfile } from "./actressProfiles.ts";
import type { EntityIndexSummary } from "./entityIndexSummaries.ts";
import { sortActressSummaries } from "./actressListSorting.ts";

const summaries: EntityIndexSummary[] = [
  { name: "A", count: 10, maxScore: 0, imageUrl: null },
  { name: "B", count: 30, maxScore: 0, imageUrl: null },
  { name: "C", count: 20, maxScore: 0, imageUrl: null },
];

const profiles = new Map<string, ActressProfile>([
  ["A", { dmm_actress_id: "1", name: "A", ruby: null, birthday: "1990-01-01", height_cm: 160, bust_cm: 80, waist_cm: 60, hip_cm: 88, cup: "B", image_url_small: null, image_url_large: null }],
  ["B", { dmm_actress_id: "2", name: "B", ruby: null, birthday: null, height_cm: 170, bust_cm: null, waist_cm: null, hip_cm: null, cup: "D", image_url_small: null, image_url_large: null }],
  ["C", { dmm_actress_id: "3", name: "C", ruby: null, birthday: "1985-01-01", height_cm: 150, bust_cm: 90, waist_cm: 65, hip_cm: 95, cup: null, image_url_small: null, image_url_large: null }],
]);

function names(sort: string) {
  return sortActressSummaries(summaries, profiles, sort).map((item) => item.name);
}

test("count and birthday sorting preserve direction and put missing birthdays last", () => {
  assert.deepEqual(names("count-desc"), ["B", "C", "A"]);
  assert.deepEqual(names("count-asc"), ["A", "C", "B"]);
  assert.deepEqual(names("birthday-asc"), ["C", "A", "B"]);
  assert.deepEqual(names("birthday-desc"), ["A", "C", "B"]);
});

test("profile metrics sort numerically with missing values last in either direction", () => {
  assert.deepEqual(names("height-desc"), ["B", "A", "C"]);
  assert.deepEqual(names("height-asc"), ["C", "A", "B"]);
  assert.deepEqual(names("bust-desc"), ["C", "A", "B"]);
  assert.deepEqual(names("cup-desc"), ["B", "A", "C"]);
});

test("unknown metric sort keys retain the existing cup fallback", () => {
  assert.deepEqual(names("unknown-asc"), ["A", "B", "C"]);
});
