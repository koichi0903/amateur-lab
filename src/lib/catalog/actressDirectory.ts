import type { ActressProfile } from "./actressProfiles";
import type { EntityIndexSummary } from "./entityIndexSummaries";

export const ACTRESS_SORTS = [
  "count-desc", "count-asc", "birthday-desc", "birthday-asc",
  "cup-desc", "cup-asc", "height-desc", "height-asc",
  "bust-desc", "bust-asc", "waist-desc", "waist-asc", "hip-desc", "hip-asc",
] as const;

export type ActressSort = (typeof ACTRESS_SORTS)[number];

type MeasurementName = "height" | "bust" | "waist" | "hip";
type MeasurementField = "height_cm" | "bust_cm" | "waist_cm" | "hip_cm";

const MEASUREMENT_FIELDS: Record<MeasurementName, MeasurementField> = {
  height: "height_cm",
  bust: "bust_cm",
  waist: "waist_cm",
  hip: "hip_cm",
};

const ACTRESS_SORT_SET = new Set<string>(ACTRESS_SORTS);

export function resolveActressSort(value: string | undefined): ActressSort {
  return value && ACTRESS_SORT_SET.has(value) ? value as ActressSort : "count-desc";
}

export function normalizeActressSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\u30a1-\u30f6]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/\s+/g, "");
}

function formatActressMeasurements(profile: ActressProfile) {
  if (!(profile.bust_cm || profile.waist_cm || profile.hip_cm || profile.cup)) return null;
  const cup = profile.cup ? ` ${profile.cup}カップ` : "";
  return `B${profile.bust_cm ?? "-"} W${profile.waist_cm ?? "-"} H${profile.hip_cm ?? "-"}${cup}`;
}

export function buildActressDirectoryProfileDetails(profile: ActressProfile | undefined) {
  if (!profile) return [];
  const height = profile.height_cm ? `身長: ${profile.height_cm}cm` : null;
  return [profile.birthday, height, formatActressMeasurements(profile)]
    .filter((detail): detail is string => Boolean(detail));
}

function compareNullable<T>(
  left: T | null,
  right: T | null,
  compareValues: (leftValue: T, rightValue: T) => number,
  descending: boolean,
) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return descending ? compareValues(right, left) : compareValues(left, right);
}

function getCupOrderValue(cup: string | null | undefined) {
  return cup
    ? [...cup.toUpperCase()].reduce((sum, letter) => sum * 27 + (letter.charCodeAt(0) - 64), 0)
    : null;
}

function getMeasurementValue(profile: ActressProfile | undefined, sort: ActressSort) {
  const measurement = sort.slice(0, sort.lastIndexOf("-"));
  if (measurement === "cup") return getCupOrderValue(profile?.cup);
  const field = MEASUREMENT_FIELDS[measurement as MeasurementName];
  return profile?.[field] ?? null;
}

function compareByCount(sort: ActressSort, left: EntityIndexSummary, right: EntityIndexSummary) {
  return sort === "count-desc" ? right.count - left.count : left.count - right.count;
}

function compareByBirthday(
  sort: ActressSort,
  left: EntityIndexSummary,
  right: EntityIndexSummary,
  profileByName: Map<string, ActressProfile>,
) {
  const leftBirthday = profileByName.get(left.name)?.birthday ?? null;
  const rightBirthday = profileByName.get(right.name)?.birthday ?? null;
  return compareNullable(leftBirthday, rightBirthday, (a, b) => a.localeCompare(b), sort === "birthday-desc");
}

function compareByMeasurement(
  sort: ActressSort,
  left: EntityIndexSummary,
  right: EntityIndexSummary,
  profileByName: Map<string, ActressProfile>,
) {
  const leftValue = getMeasurementValue(profileByName.get(left.name), sort);
  const rightValue = getMeasurementValue(profileByName.get(right.name), sort);
  return compareNullable(leftValue, rightValue, (a, b) => a - b, sort.endsWith("-desc"));
}

function createActressComparator(sort: ActressSort, profileByName: Map<string, ActressProfile>) {
  if (sort.startsWith("count-")) return (left: EntityIndexSummary, right: EntityIndexSummary) => compareByCount(sort, left, right);
  if (sort.startsWith("birthday-")) return (left: EntityIndexSummary, right: EntityIndexSummary) => compareByBirthday(sort, left, right, profileByName);
  return (left: EntityIndexSummary, right: EntityIndexSummary) => compareByMeasurement(sort, left, right, profileByName);
}

export function prepareActressDirectory(
  summaries: EntityIndexSummary[],
  profiles: ActressProfile[],
  query: string,
  sort: ActressSort,
) {
  const profileByName = new Map(profiles.map((profile) => [profile.name, profile]));
  const normalizedQuery = normalizeActressSearchText(query);
  const filtered = normalizedQuery
    ? summaries.filter((summary) => {
      const profile = profileByName.get(summary.name);
      return normalizeActressSearchText(summary.name).includes(normalizedQuery)
        || normalizeActressSearchText(profile?.ruby).includes(normalizedQuery);
    })
    : summaries;

  return {
    sorted: [...filtered].sort(createActressComparator(sort, profileByName)),
    profileByName,
  };
}
