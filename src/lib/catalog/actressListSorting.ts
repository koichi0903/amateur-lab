import type { ActressProfile } from "./actressProfiles";
import type { EntityIndexSummary } from "./entityIndexSummaries";

type ActressNumericField = "height_cm" | "bust_cm" | "waist_cm" | "hip_cm";

function profileValue(profile: ActressProfile | undefined, field: ActressNumericField) {
  return profile?.[field] ?? null;
}

function cupValue(profile: ActressProfile | undefined) {
  if (!profile?.cup) return null;
  return [...profile.cup.toUpperCase()].reduce((sum, letter) => sum * 27 + (letter.charCodeAt(0) - 64), 0);
}

function compareCount(a: EntityIndexSummary, b: EntityIndexSummary, sort: string) {
  return sort === "count-desc" ? b.count - a.count : a.count - b.count;
}

function compareBirthday(a: EntityIndexSummary, b: EntityIndexSummary, sort: string, profiles: Map<string, ActressProfile>) {
  const aValue = profiles.get(a.name)?.birthday ?? null;
  const bValue = profiles.get(b.name)?.birthday ?? null;
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  return sort === "birthday-asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
}

function profileFieldForSort(sort: string): ActressNumericField | "cup" {
  const fieldKey = sort.replace(/-(?:asc|desc)$/, "");
  if (fieldKey === "height") return "height_cm";
  if (fieldKey === "bust") return "bust_cm";
  if (fieldKey === "waist") return "waist_cm";
  if (fieldKey === "hip") return "hip_cm";
  return "cup";
}

function compareNullableNumbers(aValue: number | null, bValue: number | null, descending: boolean) {
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  return descending ? bValue - aValue : aValue - bValue;
}

function compareProfileMetric(a: EntityIndexSummary, b: EntityIndexSummary, sort: string, profiles: Map<string, ActressProfile>) {
  const field = profileFieldForSort(sort);
  const aProfile = profiles.get(a.name);
  const bProfile = profiles.get(b.name);
  const aValue = field === "cup" ? cupValue(aProfile) : profileValue(aProfile, field);
  const bValue = field === "cup" ? cupValue(bProfile) : profileValue(bProfile, field);
  return compareNullableNumbers(aValue, bValue, sort.endsWith("-desc"));
}

export function compareActressSummaries(
  a: EntityIndexSummary,
  b: EntityIndexSummary,
  sort: string,
  profiles: Map<string, ActressProfile>,
) {
  if (sort === "count-desc" || sort === "count-asc") return compareCount(a, b, sort);
  if (sort === "birthday-asc" || sort === "birthday-desc") return compareBirthday(a, b, sort, profiles);
  return compareProfileMetric(a, b, sort, profiles);
}

export function sortActressSummaries(items: EntityIndexSummary[], profiles: Map<string, ActressProfile>, sort: string) {
  return [...items].sort((a, b) => compareActressSummaries(a, b, sort, profiles));
}
