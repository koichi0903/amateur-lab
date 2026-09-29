import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DmmActressProfile } from "@/types/dmm";

const DMM_ENDPOINT = "https://api.dmm.com/affiliate/v3/ActressSearch";
const DEFAULT_PAGE_SIZE = 100;
const DMM_REQUEST_TIMEOUT_MS = 30_000;
const DMM_MAX_ATTEMPTS = 3;

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
  let response: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= DMM_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DMM_REQUEST_TIMEOUT_MS);
    try {
      response = await fetch(`${DMM_ENDPOINT}?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok || (response.status < 400 && response.status !== 429)) break;
      lastError = new Error(`DMM女優APIがHTTP ${response.status}を返しました。`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < DMM_MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
  if (!response) throw lastError instanceof Error ? lastError : new Error("DMM女優APIへの接続に失敗しました。");
  if (!response.ok) throw new Error(`DMM女優APIがHTTP ${response.status}を返しました。`);

  const payload = (await response.json()) as {
    result?: {
      status?: string | number;
      actress?: DmmActressProfile[];
      total_count?: string | number;
    };
  };
  const result = payload.result;
  if (!result || String(result.status ?? "200") !== "200") {
    throw new Error("DMM女優APIの応答が不正です。");
  }

  const profiles = (result.actress ?? []).map(normalizeProfile).filter((profile): profile is NonNullable<ReturnType<typeof normalizeProfile>> => Boolean(profile));
  if (profiles.length > 0) {
    const { error } = await supabaseAdmin.from("actress_profiles").upsert(profiles, { onConflict: "dmm_actress_id" });
    if (error) throw error;
  }

  const totalCount = Number(result.total_count ?? 0);
  const nextOffset = profiles.length > 0 && offset + pageSize <= totalCount ? offset + pageSize : null;
  return { processedCount: profiles.length, totalCount, offset, nextOffset, completed: nextOffset === null };
}
