import "server-only";

import { getDmmFanzaAmateurPopularWorks } from "@/lib/dmm/fanzaAmateurCatalog";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trimVideoForX } from "@/lib/xVideoTrim";

export const AMATEUR_X_PAGE_SIZE = 30;
const JOB_FIELDS = "id,account_handle,content_id,source_lane,status,main_text,reply_text,x_post_url,posted_at,created_at";

function jobTableError(prefix: string, error: { code?: string; message: string }) {
  if (error.code === "42P01" || error.code === "PGRST205") return new Error("投稿準備テーブルがまだありません。Supabaseへ同梱マイグレーションを適用すると利用できます。");
  return new Error(`${prefix}: ${error.message}`);
}

type AmateurWork = {
  content_id: string;
  title: string | null;
  api_date: string | null;
  mp4_url: string | null;
  mp4_status: string | null;
  is_listed: boolean;
  image_url: unknown;
};

type Job = {
  id: number;
  account_handle: string;
  content_id: string;
  source_lane: "new_release" | "popular";
  status: "pending" | "posted" | "skipped";
  main_text: string;
  reply_text: string;
  x_post_url: string | null;
  posted_at: string | null;
  created_at: string;
};

export function normalizeXHandle(value: unknown) {
  const handle = String(value ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

function tokyoDateOffset(days: number) {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString().slice(0, 10);
}

function imageUrl(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["large", "list", "small"]) if (typeof record[key] === "string" && record[key]) return record[key] as string;
  return null;
}

function postCopy(handle: string, work: AmateurWork) {
  const release = work.api_date?.slice(0, 10) ?? "";
  const dateLabel = /^\d{4}-(\d{2})-(\d{2})$/.exec(release);
  const releaseLabel = dateLabel ? `${Number(dateLabel[1])}月${Number(dateLabel[2])}日発売` : "FANZA素人作品";
  const postKey = encodeURIComponent(`amateur-${handle}-${work.content_id}`);
  return {
    mainText: `【${releaseLabel}】\n${work.title ?? work.content_id}`,
    replyText: `👇作品詳細・価格推移はこちら\nhttps://hakkutsu-lab.com/amateur/${encodeURIComponent(work.content_id)}?from=x&x_post=${postKey}`,
  };
}

async function getWorksByIds(ids: string[]) {
  if (!ids.length) return new Map<string, AmateurWork>();
  const result = await supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,api_date,mp4_url,mp4_status,is_listed,image_url")
    .in("content_id", ids);
  if (result.error) throw new Error(`素人作品データを取得できませんでした: ${result.error.message}`);
  return new Map((result.data ?? []).map((row) => [row.content_id, row as AmateurWork]));
}

async function getSelectedJobs(handle: string, contentIds: string[]) {
  if (!contentIds.length) return new Map<string, Job>();
  const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs")
    .select(JOB_FIELDS).eq("account_handle", handle).in("content_id", contentIds);
  if (result.error) throw jobTableError("選択状況を取得できませんでした", result.error);
  return new Map((result.data ?? []).map((row) => [row.content_id, row as Job]));
}

export async function getAmateurXCandidates(handle: string, lane: "new_release" | "popular", page = 1) {
  const safePage = Math.max(1, Math.trunc(page));
  let orderedIds: string[];
  let total: number;
  let ranked = [] as Awaited<ReturnType<typeof getDmmFanzaAmateurPopularWorks>>;
  if (lane === "popular") {
    ranked = await getDmmFanzaAmateurPopularWorks(500);
    orderedIds = ranked.map((item) => item.content_id);
    const works = await getWorksByIds(orderedIds);
    const idsWithMedia = orderedIds.filter((id) => {
      const work = works.get(id);
      return Boolean(work?.is_listed && work.mp4_status === "found" && work.mp4_url);
    });
    total = idsWithMedia.length;
    orderedIds = idsWithMedia.slice((safePage - 1) * AMATEUR_X_PAGE_SIZE, safePage * AMATEUR_X_PAGE_SIZE);
  } else {
    const today = tokyoDateOffset(0);
    const endExclusive = tokyoDateOffset(8);
    const count = await supabaseAdmin.from("fanza_amateur_works").select("content_id", { count: "exact", head: true })
      .eq("is_listed", true).eq("mp4_status", "found").not("mp4_url", "is", null)
      .gte("api_date", today).lt("api_date", endExclusive);
    if (count.error) throw new Error(`新作候補数を取得できませんでした: ${count.error.message}`);
    total = count.count ?? 0;
    const from = (safePage - 1) * AMATEUR_X_PAGE_SIZE;
    const rows = await supabaseAdmin.from("fanza_amateur_works")
      .select("content_id,title,api_date,mp4_url,mp4_status,is_listed,image_url")
      .eq("is_listed", true).eq("mp4_status", "found").not("mp4_url", "is", null)
      .gte("api_date", today).lt("api_date", endExclusive)
      .order("api_date", { ascending: true }).order("content_id", { ascending: true })
      .range(from, from + AMATEUR_X_PAGE_SIZE - 1);
    if (rows.error) throw new Error(`新作候補を取得できませんでした: ${rows.error.message}`);
    const works = (rows.data ?? []) as AmateurWork[];
    const selected = await getSelectedJobs(handle, works.map((work) => work.content_id));
    return {
      candidates: works.map((work) => ({ ...work, image: imageUrl(work.image_url), job: selected.get(work.content_id) ?? null })),
      total,
      page: safePage,
      hasMore: from + works.length < total,
    };
  }

  const works = await getWorksByIds(orderedIds);
  const rankById = new Map(ranked.map((item, index) => [item.content_id, index + 1]));
  const selected = await getSelectedJobs(handle, orderedIds);
  const candidates = orderedIds.flatMap((id) => {
    const work = works.get(id);
    if (!work) return [];
    return [{ ...work, image: imageUrl(work.image_url), rank: rankById.get(id) ?? null, job: selected.get(id) ?? null }];
  });
  return { candidates, total, page: safePage, hasMore: safePage * AMATEUR_X_PAGE_SIZE < total };
}

async function loadEligibleWork(contentId: string) {
  const result = await supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,api_date,mp4_url,mp4_status,is_listed,image_url")
    .eq("content_id", contentId).maybeSingle();
  if (result.error) throw new Error(`作品を取得できませんでした: ${result.error.message}`);
  const work = result.data as AmateurWork | null;
  if (!work || !work.is_listed || work.mp4_status !== "found" || !work.mp4_url) throw new Error("MP4補完済みの掲載中作品だけ選択できます。");
  return work;
}

export async function getAmateurXDashboard(handle: string, lane: "new_release" | "popular", page = 1) {
  const [candidatePage, jobsResult] = await Promise.all([
    getAmateurXCandidates(handle, lane, page),
    supabaseAdmin.from("fanza_amateur_x_post_jobs").select(JOB_FIELDS).eq("account_handle", handle)
      .order("created_at", { ascending: false }).limit(100),
  ]);
  if (jobsResult.error) throw jobTableError("投稿履歴を取得できませんでした", jobsResult.error);
  const jobs = (jobsResult.data ?? []) as unknown as Job[];
  const works = await getWorksByIds([...new Set(jobs.map((job) => job.content_id))]);
  return {
    ...candidatePage,
    jobs: jobs.map((job) => ({ ...job, work: works.get(job.content_id) ?? null, image: imageUrl(works.get(job.content_id)?.image_url) })),
  };
}

export async function createAmateurXJob(handle: string, contentId: string, lane: "new_release" | "popular") {
  const work = await loadEligibleWork(contentId);
  if (lane === "new_release") {
    const date = work.api_date?.slice(0, 10) ?? "";
    if (date < tokyoDateOffset(0) || date >= tokyoDateOffset(8)) throw new Error("新作7日間の候補ではありません。");
  } else {
    const top500 = await getDmmFanzaAmateurPopularWorks(500);
    if (!top500.some((item) => item.content_id === contentId)) throw new Error("人気動画TOP500の候補ではありません。");
  }
  const texts = postCopy(handle, work);
  const inserted = await supabaseAdmin.from("fanza_amateur_x_post_jobs")
    .insert({ account_handle: handle, content_id: contentId, source_lane: lane, status: "pending", ...texts })
    .select(JOB_FIELDS).single();
  if (inserted.error?.code === "23505") return { ok: false, error: "このアカウントにはすでに追加されています。" };
  if (inserted.error) throw jobTableError("投稿準備を保存できませんでした", inserted.error);
  return { ok: true, job: inserted.data as unknown as Job };
}

export async function updateAmateurXJobText(handle: string, jobId: number, mainText: string, replyText: string) {
  if (!mainText.trim() || mainText.length > 280 || !replyText.trim() || replyText.length > 280) throw new Error("本文と自己リプは1〜280文字で入力してください。");
  const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs").update({ main_text: mainText, reply_text: replyText })
    .eq("account_handle", handle).eq("id", jobId).eq("status", "pending").select("id").maybeSingle();
  if (result.error) throw jobTableError("投稿文を保存できませんでした", result.error);
  if (!result.data) throw new Error("更新対象の投稿候補がありません。");
  return { ok: true };
}

export async function updateAmateurXJobStatus(handle: string, jobId: number, status: "posted" | "skipped", xPostUrl?: string, mainText?: string, replyText?: string) {
  const loaded = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id,status")
    .eq("account_handle", handle).eq("id", jobId).maybeSingle();
  if (loaded.error) throw jobTableError("投稿候補を確認できませんでした", loaded.error);
  if (!loaded.data || loaded.data.status !== "pending") throw new Error("投稿候補はすでに処理済みです。");
  if (status === "posted" && (!mainText?.trim() || mainText.length > 280 || !replyText?.trim() || replyText.length > 280)) throw new Error("本文と自己リプを確認してから投稿済みにしてください。");
  const postUrl = xPostUrl?.trim() ?? "";
  if (postUrl && (!/^https:\/\/(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+\/?$/.test(postUrl))) throw new Error("X投稿URLの形式が正しくありません。");
  let update = supabaseAdmin.from("fanza_amateur_x_post_jobs")
    .update({ status, x_post_url: postUrl || null, posted_at: status === "posted" ? new Date().toISOString() : null,
      ...(status === "posted" ? { main_text: mainText, reply_text: replyText } : {}) })
    .eq("account_handle", handle).eq("id", jobId).eq("status", "pending");
  const result = await update.select("id").maybeSingle();
  if (result.error) throw jobTableError("投稿状態を保存できませんでした", result.error);
  if (!result.data) throw new Error("投稿候補の状態が変わっています。画面を更新してください。");
  return { ok: true };
}

export async function getAmateurXJobVideo(handle: string, jobId: number, trimStartSeconds: number) {
  const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("content_id,status")
    .eq("account_handle", handle).eq("id", jobId).maybeSingle();
  if (result.error) throw jobTableError("動画対象を確認できませんでした", result.error);
  if (!result.data || result.data.status !== "pending") throw new Error("動画を準備できる投稿候補がありません。");
  const work = await loadEligibleWork(result.data.content_id);
  const source = new URL(work.mp4_url!);
  const allowedDomains = ["dmm.co.jp", "dmm.com", "fanza.co.jp"];
  if (source.protocol !== "https:" || !allowedDomains.some((domain) => source.hostname === domain || source.hostname.endsWith(`.${domain}`))) throw new Error("公式DMM/FANZA動画URLではありません。");
  const trimmed = await trimVideoForX({ sourceUrl: source.toString(), trimStartSeconds });
  const filenameId = result.data.content_id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
  return { file: trimmed.file, dir: trimmed.dir, filename: `amateur-${filenameId}.mp4` };
}

