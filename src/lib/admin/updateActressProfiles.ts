import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DmmActressProfile } from "@/types/dmm";
import { fetchDmmActressProfiles } from "./actressProfileApi";

const DMM_ENDPOINT = "https://api.dmm.com/affiliate/v3/ActressSearch";
const DEFAULT_PAGE_SIZE = 100;

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

function normalizeProfile(value: DmmActressProfile) {
  const dmmId = asId(value.actress_id ?? value.id);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!dmmId || !name) return null;

  return {
    dmm_actress_id: dmmId,
    name,
    ruby: value.ruby?.trim() || null,
    birthday: value.birthday || null,
    height_cm: asNumber(value.height),
    bust_cm: asNumber(value.bust),
    waist_cm: asNumber(value.waist),
    hip_cm: asNumber(value.hip),
    cup: value.cup?.trim() || null,
    blood_type: value.blood_type?.trim() || null,
    hobby: value.hobby?.trim() || null,
    prefectures: value.prefectures?.trim() || null,
    image_url_small: httpsUrl(value.imageURL?.small),
    image_url_large: httpsUrl(value.imageURL?.large),
    fanza_digital_url: value.listURL?.digital || null,
    updated_at: new Date().toISOString(),
  };
}

export async function updateActressProfiles(offset = 1, requestedPageSize = DEFAULT_PAGE_SIZE) {
  const apiId = process.env.DMM_API_ID?.trim();
  const affiliateId = process.env.DMM_AFFILIATE_ID?.trim();
  if (!apiId || !affiliateId) throw new Error("DMM APIの設定がありません。");

  const pageSize = Math.min(Math.max(requestedPageSize, 1), DEFAULT_PAGE_SIZE);
  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    output: "json",
    hits: String(pageSize),
    offset: String(Math.max(1, offset)),
    sort: "id",
  });
  const result = await fetchDmmActressProfiles(`${DMM_ENDPOINT}?${params.toString()}`);

  const profiles = (result.actress ?? []).map(normalizeProfile).filter((profile): profile is NonNullable<ReturnType<typeof normalizeProfile>> => Boolean(profile));
  if (profiles.length > 0) {
    const { error } = await supabaseAdmin.from("actress_profiles").upsert(profiles, { onConflict: "dmm_actress_id" });
    if (error) throw error;
  }

  const totalCount = Number(result.total_count ?? 0);
  const nextOffset = profiles.length > 0 && offset + pageSize <= totalCount ? offset + pageSize : null;
  return { processedCount: profiles.length, totalCount, offset, nextOffset, completed: nextOffset === null };
}
