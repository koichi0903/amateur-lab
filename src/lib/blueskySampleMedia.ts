import "server-only";

import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
import { trimVideoForX } from "@/lib/xVideoTrim";
import { FANZA_AMATEUR_FLOOR, getFanzaAmateurAffiliateId, getFanzaAmateurSamplePlayerUrl, normalizeFanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";
import { captureFanzaSampleMovieAsset, captureFanzaSampleMovieUrl } from "@/lib/playwright/captureFanzaSampleMovie";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sampleImages(...sources: unknown[]) {
  const urls: string[] = [];
  for (const source of sources) {
    if (!isRecord(source)) continue;
    const root = isRecord(source.sampleImageURL) ? source.sampleImageURL : source;
    for (const key of ["sample_l", "sample_s"]) {
      const group = root[key];
      if (!isRecord(group) || !Array.isArray(group.image)) continue;
      for (const value of group.image) {
        if (typeof value === "string" && isOfficialFanzaDmmSampleUrl(value) && !urls.includes(value)) urls.push(value);
      }
    }
  }
  return urls;
}

function officialWorkImage(value: unknown) {
  if (typeof value === "string") return isOfficialFanzaDmmSampleUrl(value) ? value : null;
  if (!isRecord(value)) return null;
  for (const key of ["large", "list", "small"]) {
    const url = value[key];
    if (typeof url === "string" && isOfficialFanzaDmmSampleUrl(url)) return url;
  }
  return null;
}

function normalizeContentId(value: string) {
  // FANZA product codes are often displayed with a hyphen (for example,
  // PAI-515), while the official API's content_id is commonly unhyphenated.
  const contentId = value.trim().toLowerCase().replace(/-/g, "");
  return /^[a-z0-9][a-z0-9_-]{2,79}$/.test(contentId) ? contentId : null;
}

export async function registerBlueskySampleWork(rawContentId: string) {
  const contentId = normalizeContentId(rawContentId);
  if (!contentId) throw new Error("品番の形式を確認してください。");

  const apiId = process.env.DMM_API_ID?.trim();
  if (!apiId) throw new Error("DMM API IDが設定されていません。");
  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: getFanzaAmateurAffiliateId(),
    site: "FANZA",
    service: "digital",
    floor: FANZA_AMATEUR_FLOOR,
    hits: "1",
    offset: "1",
    sort: "date",
    output: "json",
    cid: contentId,
  });
  const response = await fetch(`https://api.dmm.com/affiliate/v3/ItemList?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as { result?: { status?: number | string; items?: unknown } };
  if (!response.ok || String(payload.result?.status ?? "200") !== "200" || !Array.isArray(payload.result?.items)) {
    throw new Error(`DMM APIの取得に失敗しました（HTTP ${response.status} / API ${String(payload.result?.status ?? response.status)}）。`);
  }
  const rawItem = payload.result.items.find((value) => isRecord(value)
    && typeof value.content_id === "string"
    && value.content_id.trim().toLowerCase() === contentId);
  if (!isRecord(rawItem)) return null;
  if (typeof rawItem.floor_code === "string" && rawItem.floor_code !== FANZA_AMATEUR_FLOOR) {
    throw new Error("この品番はFANZA公式「素人」カテゴリの作品ではありません。");
  }

  const title = typeof rawItem.title === "string" ? rawItem.title.trim() : "";
  const officialUrl = typeof rawItem.URL === "string" ? rawItem.URL : "";
  let parsedOfficialUrl: URL;
  try {
    parsedOfficialUrl = new URL(officialUrl);
  } catch {
    throw new Error("FANZA公式作品ページを確認できませんでした。");
  }
  if (!title || parsedOfficialUrl.protocol !== "https:" || parsedOfficialUrl.hostname !== "video.dmm.co.jp"
    || !parsedOfficialUrl.pathname.startsWith("/amateur/content/")) {
    throw new Error("FANZA公式「素人」作品ページを確認できませんでした。");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("bluesky_sample_work_registry")
    .select("mp4_url")
    .eq("content_id", contentId)
    .maybeSingle();
  if (existingError) throw new Error(`登録済み素材を確認できませんでした: ${existingError.message}`);

  const apiCatalogItem = normalizeFanzaAmateurCatalogItem(rawItem);
  const samplePlayerUrl = apiCatalogItem ? getFanzaAmateurSamplePlayerUrl(apiCatalogItem) : null;
  let capturedMovieUrl: string | null = null;
  let browser: Awaited<ReturnType<typeof createBrowser>> | null = null;
  if (samplePlayerUrl) {
    try {
      browser = await createBrowser();
      capturedMovieUrl = await captureFanzaSampleMovieUrl(samplePlayerUrl, browser);
    } catch {
      console.warn("Bluesky official sample player capture failed", { contentId, stage: "sample_player_capture" });
    } finally {
      if (browser) await closeBrowser(browser);
    }
  }

  const previousMovieUrl = typeof existing?.mp4_url === "string" && isOfficialFanzaDmmSampleUrl(existing.mp4_url)
    ? existing.mp4_url
    : null;
  const movieUrl = capturedMovieUrl && isOfficialFanzaDmmSampleUrl(capturedMovieUrl) ? capturedMovieUrl : previousMovieUrl;
  const { error: saveError } = await supabaseAdmin
    .from("bluesky_sample_work_registry")
    .upsert({
      content_id: contentId,
      title,
      api_date: typeof rawItem.date === "string" ? rawItem.date : null,
      api_url: officialUrl,
      image_url: rawItem.imageURL ?? null,
      sample_image_url: rawItem.sampleImageURL ?? null,
      sample_movie_url: rawItem.sampleMovieURL ?? null,
      mp4_url: movieUrl,
      mp4_status: movieUrl ? "found" : "pending",
      updated_at: new Date().toISOString(),
    }, { onConflict: "content_id" });
  if (saveError) throw new Error(`素材作品を登録できませんでした: ${saveError.message}`);

  return { contentId, title, sampleMovieReady: Boolean(movieUrl) };
}

export async function getBlueskySampleWorkMedia(rawContentId: string) {
  const contentId = normalizeContentId(rawContentId);
  if (!contentId) throw new Error("品番の形式を確認してください。");
  const [result, manualResult] = await Promise.all([supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,api_date,api_url,is_listed,mp4_url,mp4_status,image_url,sample_image_url,raw_item")
    .eq("content_id", contentId)
    .maybeSingle(), supabaseAdmin.from("bluesky_sample_work_registry")
    .select("content_id,title,api_date,api_url,mp4_url,mp4_status,image_url,sample_image_url,sample_movie_url")
    .eq("content_id", contentId)
    .maybeSingle()]);
  if (result.error) throw new Error(`作品データを取得できませんでした: ${result.error.message}`);
  if (manualResult.error) throw new Error(`素材登録データを取得できませんでした: ${manualResult.error.message}`);
  if (!result.data && !manualResult.data) return null;

  const row = (result.data ?? manualResult.data) as RecordValue;
  const manual = manualResult.data as RecordValue | null;
  const mainMovie = typeof result.data?.mp4_url === "string" && isOfficialFanzaDmmSampleUrl(result.data.mp4_url) ? result.data.mp4_url : null;
  const registeredMovie = typeof manual?.mp4_url === "string" && isOfficialFanzaDmmSampleUrl(manual.mp4_url) ? manual.mp4_url : null;
  const movie = registeredMovie ?? mainMovie;
  const rawCatalogItem = isRecord(row.raw_item)
    ? {
        ...row.raw_item,
        sampleMovieURL: row.raw_item.sampleMovieURL ?? manual?.sample_movie_url,
      }
    : {
        content_id: row.content_id,
        title: row.title,
        URL: typeof result.data?.api_url === "string" ? result.data.api_url : manual?.api_url,
        sampleMovieURL: manual?.sample_movie_url,
      };
  const catalogItem = normalizeFanzaAmateurCatalogItem(rawCatalogItem);
  const samplePlayerUrl = catalogItem ? getFanzaAmateurSamplePlayerUrl(catalogItem) : null;
  return {
    contentId: String(row.content_id),
    title: typeof row.title === "string" ? row.title : null,
    apiUrl: typeof result.data?.api_url === "string"
      ? result.data.api_url
      : typeof manual?.api_url === "string" ? manual.api_url : null,
    releaseDate: typeof row.api_date === "string" ? row.api_date.slice(0, 10) : null,
    isListed: result.data ? result.data.is_listed === true : true,
    officialWorkImageUrl: officialWorkImage(row.image_url ?? manual?.image_url),
    sampleImageUrls: sampleImages(row.sample_image_url, row.raw_item, manual?.sample_image_url),
    sampleMovieUrl: movie,
    samplePlayerUrl,
    sampleMovieReady: Boolean(movie && (registeredMovie ? manual?.mp4_status === "found" : result.data?.mp4_status === "found")),
  };
}

export async function createBlueskyTrimmedSample(rawContentId: string, startSeconds: number, endSeconds: number) {
  const work = await getBlueskySampleWorkMedia(rawContentId);
  if (!work) throw new Error("作品が登録データに見つかりません。");
  if (!work.sampleMovieUrl || !work.sampleMovieReady) throw new Error("公式サンプル動画が登録済みの作品ではありません。");
  let sourceUrl = work.sampleMovieUrl;
  let sourceBytes: Buffer | undefined;
  if (work.samplePlayerUrl) {
    let browser: Awaited<ReturnType<typeof createBrowser>> | null = null;
    try {
      browser = await createBrowser();
      const sample = await captureFanzaSampleMovieAsset(work.samplePlayerUrl, browser, {
        maxBytes: 100 * 1024 * 1024,
        requestTimeoutMs: 25_000,
      });
      if (sample && isOfficialFanzaDmmSampleUrl(sample.url)) {
        sourceUrl = sample.url;
        sourceBytes = sample.bytes;
      }
    } catch {
      console.warn("Bluesky official sample player refresh failed", {
        contentId: work.contentId,
        stage: "sample_player_capture",
      });
    } finally {
      if (browser) await closeBrowser(browser);
    }
  }
  const result = await trimVideoForX({
    sourceUrl,
    sourceBytes,
    trimStartSeconds: startSeconds,
    trimEndSeconds: endSeconds,
  }, { maxBytes: 100 * 1024 * 1024, timeoutMs: 25_000, followOfficialRedirects: true });
  return { ...result, filename: `bluesky-${work.contentId.replace(/[^a-z0-9_-]/gi, "_")}.mp4` };
}

export async function streamAndCleanupBlueskyTrim(result: Awaited<ReturnType<typeof createBlueskyTrimmedSample>>) {
  try {
    const info = await stat(result.file);
    const stream = createReadStream(result.file);
    stream.once("close", () => { void rm(result.dir, { recursive: true, force: true }); });
    return { body: Readable.toWeb(stream) as ReadableStream<Uint8Array>, size: info.size, filename: result.filename };
  } catch (error) {
    await rm(result.dir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
