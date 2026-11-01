import "server-only";

import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isOfficialFanzaDmmSampleUrl } from "@/lib/xMediaAssets";
import { trimVideoForX } from "@/lib/xVideoTrim";

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
  const contentId = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{2,79}$/.test(contentId) ? contentId : null;
}

export async function getBlueskySampleWorkMedia(rawContentId: string) {
  const contentId = normalizeContentId(rawContentId);
  if (!contentId) throw new Error("品番の形式を確認してください。");
  const result = await supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,api_date,is_listed,mp4_url,mp4_status,image_url,sample_image_url,raw_item")
    .eq("content_id", contentId)
    .maybeSingle();
  if (result.error) throw new Error(`作品データを取得できませんでした: ${result.error.message}`);
  if (!result.data) return null;

  const row = result.data as RecordValue;
  const movie = typeof row.mp4_url === "string" && isOfficialFanzaDmmSampleUrl(row.mp4_url) ? row.mp4_url : null;
  return {
    contentId: String(row.content_id),
    title: typeof row.title === "string" ? row.title : null,
    releaseDate: typeof row.api_date === "string" ? row.api_date.slice(0, 10) : null,
    isListed: row.is_listed === true,
    officialWorkImageUrl: officialWorkImage(row.image_url),
    sampleImageUrls: sampleImages(row.sample_image_url, row.raw_item),
    sampleMovieUrl: movie,
    sampleMovieReady: Boolean(movie && row.mp4_status === "found"),
  };
}

export async function createBlueskyTrimmedSample(rawContentId: string, startSeconds: number, endSeconds: number) {
  const work = await getBlueskySampleWorkMedia(rawContentId);
  if (!work) throw new Error("作品が登録データに見つかりません。");
  if (!work.sampleMovieUrl || !work.sampleMovieReady) throw new Error("公式サンプル動画が登録済みの作品ではありません。");
  const result = await trimVideoForX({ sourceUrl: work.sampleMovieUrl, trimStartSeconds: startSeconds, trimEndSeconds: endSeconds });
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
