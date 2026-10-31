import assert from "node:assert/strict";
import test from "node:test";
import type { ActressProfile } from "./actressProfiles";
import type { EntityIndexSummary } from "./entityIndexSummaries";
import { buildActressDirectoryProfileDetails, prepareActressDirectory, resolveActressSort, type ActressSort } from "./actressDirectory";

const summaries: EntityIndexSummary[] = [
  { name: "Ann", count: 4, maxScore: 0, imageUrl: null },
  { name: "Ben", count: 1, maxScore: 0, imageUrl: null },
  { name: "Chika", count: 3, maxScore: 0, imageUrl: null },
  { name: "Dee", count: 2, maxScore: 0, imageUrl: null },
];

function profile(
  name: string,
  values: Partial<ActressProfile> = {},
): ActressProfile {
  return {
    dmm_actress_id: name,
    name,
    ruby: null,
    birthday: null,
    height_cm: null,
    bust_cm: null,
    waist_cm: null,
    hip_cm: null,
    cup: null,
    image_url_small: null,
    image_url_large: null,
    ...values,
  };
}

const profiles = [
  profile("Ann", { birthday: "1990-01-01", height_cm: 160, bust_cm: 80, waist_cm: 60, hip_cm: 85, cup: "B" }),
  profile("Ben", { birthday: "1980-01-01", height_cm: 170, bust_cm: 90, waist_cm: 70, hip_cm: 95, cup: "DD" }),
  profile("Chika", { birthday: "2000-01-01", height_cm: 155, bust_cm: 75, waist_cm: 55, hip_cm: 80, cup: "AA" }),
  profile("Dee"),
];

function namesForSort(sort: ActressSort) {
  return prepareActressDirectory(summaries, profiles, "", sort).sorted.map((summary) => summary.name);
}

test("actress directory supports all count, birthday, cup, and measurement sort directions", () => {
  const cases: Array<[ActressSort, string[]]> = [
    ["count-desc", ["Ann", "Chika", "Dee", "Ben"]],
    ["count-asc", ["Ben", "Dee", "Chika", "Ann"]],
    ["birthday-desc", ["Chika", "Ann", "Ben", "Dee"]],
    ["birthday-asc", ["Ben", "Ann", "Chika", "Dee"]],
    ["cup-desc", ["Ben", "Chika", "Ann", "Dee"]],
    ["cup-asc", ["Ann", "Chika", "Ben", "Dee"]],
    ["height-desc", ["Ben", "Ann", "Chika", "Dee"]],
    ["height-asc", ["Chika", "Ann", "Ben", "Dee"]],
    ["bust-desc", ["Ben", "Ann", "Chika", "Dee"]],
    ["bust-asc", ["Chika", "Ann", "Ben", "Dee"]],
    ["waist-desc", ["Ben", "Ann", "Chika", "Dee"]],
    ["waist-asc", ["Chika", "Ann", "Ben", "Dee"]],
    ["hip-desc", ["Ben", "Ann", "Chika", "Dee"]],
    ["hip-asc", ["Chika", "Ann", "Ben", "Dee"]],
  ];

  for (const [sort, expected] of cases) assert.deepEqual(namesForSort(sort), expected, sort);
});

test("actress directory searches normalized names and profile ruby while preserving source rows", () => {
  const searchable = [
    { name: "山田ゆめ", count: 1, maxScore: 0, imageUrl: null },
    { name: "花子", count: 2, maxScore: 0, imageUrl: null },
  ];
  const result = prepareActressDirectory(
    searchable,
    [profile("山田ゆめ"), profile("花子", { ruby: "ﾕﾒ" })],
    "  ユメ ",
    "count-desc",
  );

  assert.deepEqual(result.sorted.map((summary) => summary.name), ["花子", "山田ゆめ"]);
  assert.deepEqual(searchable.map((summary) => summary.name), ["山田ゆめ", "花子"]);
  assert.equal(result.profileByName.get("花子")?.ruby, "ﾕﾒ");
});

test("invalid actress sort values fall back to registration count descending", () => {
  assert.equal(resolveActressSort(undefined), "count-desc");
  assert.equal(resolveActressSort("unknown"), "count-desc");
  assert.equal(resolveActressSort("height-asc"), "height-asc");
});

test("actress directory profile details keep the existing labels and omit missing values", () => {
  assert.deepEqual(
    buildActressDirectoryProfileDetails(profile("Ann", {
      birthday: "1990-01-01",
      height_cm: 160,
      bust_cm: 80,
      hip_cm: 85,
      cup: "B",
    })),
    ["1990-01-01", "身長: 160cm", "B80 W- H85 Bカップ"],
  );
  assert.deepEqual(buildActressDirectoryProfileDetails(profile("Ben")), []);
  assert.deepEqual(buildActressDirectoryProfileDetails(undefined), []);
});
