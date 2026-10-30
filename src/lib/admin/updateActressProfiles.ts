import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchDmmActressProfiles } from "./actressProfileApi";
import { normalizeDmmActressProfile } from "./actressProfileNormalization";

const DMM_ENDPOINT = "https://api.dmm.com/affiliate/v3/ActressSearch";
const DEFAULT_PAGE_SIZE = 100;

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

  const profiles = (result.actress ?? [])
    .map((profile) => normalizeDmmActressProfile(profile))
    .filter((profile): profile is NonNullable<ReturnType<typeof normalizeDmmActressProfile>> => Boolean(profile));
  if (profiles.length > 0) {
    const { error } = await supabaseAdmin.from("actress_profiles").upsert(profiles, { onConflict: "dmm_actress_id" });
    if (error) throw error;
  }

  const totalCount = Number(result.total_count ?? 0);
  const nextOffset = profiles.length > 0 && offset + pageSize <= totalCount ? offset + pageSize : null;
  return { processedCount: profiles.length, totalCount, offset, nextOffset, completed: nextOffset === null };
}
