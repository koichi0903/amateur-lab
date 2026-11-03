import type { DmmActressProfile } from "@/types/dmm";

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

function asId(value: unknown) {
  const number = asNumber(value);
  return number !== null ? String(number) : null;
}

function httpsUrl(value: string | null | undefined) {
  return value?.replace(/^http:/i, "https:") ?? null;
}

function trimmedOrNull(value: string | null | undefined) {
  return value?.trim() || null;
}

function valueOrNull(value: string | null | undefined) {
  return value || null;
}

export function normalizeDmmActressProfile(value: DmmActressProfile, now = () => new Date()) {
  const dmmId = asId(value.actress_id ?? value.id);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!dmmId || !name) return null;

  return {
    dmm_actress_id: dmmId,
    name,
    ruby: trimmedOrNull(value.ruby),
    birthday: valueOrNull(value.birthday),
    height_cm: asNumber(value.height),
    bust_cm: asNumber(value.bust),
    waist_cm: asNumber(value.waist),
    hip_cm: asNumber(value.hip),
    cup: trimmedOrNull(value.cup),
    blood_type: trimmedOrNull(value.blood_type),
    hobby: trimmedOrNull(value.hobby),
    prefectures: trimmedOrNull(value.prefectures),
    image_url_small: httpsUrl(value.imageURL?.small),
    image_url_large: httpsUrl(value.imageURL?.large),
    fanza_digital_url: valueOrNull(value.listURL?.digital),
    updated_at: now().toISOString(),
  };
}
