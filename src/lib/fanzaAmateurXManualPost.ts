import "server-only";

import { getDmmFanzaAmateurPopularWorks, getFanzaAmateurAffiliateId, normalizeFanzaAmateurCatalogItem } from "@/lib/dmm/fanzaAmateurCatalog";
import { AMATEUR_X_POSTED_COOLDOWN_DAYS, AMATEUR_X_SHARED_QUEUE_ACCOUNT, amateurXPostJobStatusColumns, amateurXPostJobTextColumns, buildAmateurXReplyText, getLegacyAmateurXReplyTrackingKey, getRecentlyPostedContentIds, getXPostAccountHandle, mergeAmateurXCandidateJobs, withoutSkippedAmateurXCandidates, type AmateurXCandidateJobState } from "@/lib/fanzaAmateurXPostHelpers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trimVideoForX } from "@/lib/xVideoTrim";
import { priceNumber } from "@/lib/dmm/fanzaAmateurCatalogNormalize";

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
  prices: { price?: string; list_price?: string } | null;
  raw_item?: unknown;
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

function affiliateUrlForWork(work: AmateurWork) {
  const item = normalizeFanzaAmateurCatalogItem(work.raw_item);
  if (!item || typeof item.URL !== "string" || !item.URL) return null;
  try {
    const target = new URL(item.URL);
    if (target.protocol !== "https:" || target.hostname !== "video.dmm.co.jp" || target.username || target.password || !target.pathname.startsWith("/amateur/content/")) return null;
    const affiliate = new URL("https://al.fanza.co.jp/");
    affiliate.searchParams.set("lurl", target.href);
    affiliate.searchParams.set("af_id", getFanzaAmateurAffiliateId());
    return affiliate.href;
  } catch {
    return null;
  }
}

function postCopy(work: AmateurWork) {
  const release = work.api_date?.slice(0, 10) ?? "";
  const dateLabel = /^\d{4}-(\d{2})-(\d{2})$/.exec(release);
  const releaseLabel = dateLabel ? `${Number(dateLabel[1])}月${Number(dateLabel[2])}日発売` : "FANZA素人作品";
  const currentPrice = priceNumber(work.prices?.price) ?? priceNumber(work.prices?.list_price);
  const affiliateUrl = affiliateUrlForWork(work);
  if (!affiliateUrl) throw new Error("FANZAの公式アフィリエイトリンクを確認できませんでした。");
  return {
    mainText: `【${releaseLabel}】\n${work.title ?? work.content_id}`,
    replyText: buildAmateurXReplyText(work.title ?? work.content_id, currentPrice, affiliateUrl),
  };
}

async function getWorksByIds(ids: string[]) {
  if (!ids.length) return new Map<string, AmateurWork>();
  const result = await supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,api_date,mp4_url,mp4_status,is_listed,image_url,prices,raw_item")
    .in("content_id", ids);
  if (result.error) throw new Error(`素人作品データを取得できませんでした: ${result.error.message}`);
  return new Map((result.data ?? []).map((row) => [row.content_id, row as AmateurWork]));
}

async function getSelectedJobs(contentIds: string[], lane: "new_release" | "popular") {
  if (!contentIds.length) return new Map<string, AmateurXCandidateJobState>();
  const [pendingResult, sharedHistoryResult] = await Promise.all([
    supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id,content_id,status")
      .eq("status", "pending").in("content_id", contentIds),
    supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id,content_id,status,posted_at,created_at")
      .eq("account_handle", AMATEUR_X_SHARED_QUEUE_ACCOUNT).eq("source_lane", lane).in("content_id", contentIds),
  ]);
  if (pendingResult.error) throw jobTableError("選択状況を取得できませんでした", pendingResult.error);
  if (sharedHistoryResult.error) throw jobTableError("選択状況を取得できませんでした", sharedHistoryResult.error);
  const sharedHistory = (sharedHistoryResult.data ?? []) as AmateurXCandidateJobState[];
  return mergeAmateurXCandidateJobs(
    (pendingResult.data ?? []) as AmateurXCandidateJobState[],
    lane === "popular" ? sharedHistory.filter((job) => job.status !== "posted") : sharedHistory,
  );
}

async function getSkippedCandidateIds(contentIds: string[], lane: "new_release" | "popular") {
  const skippedIds = new Set<string>();
  for (let offset = 0; offset < contentIds.length; offset += 500) {
    const batchIds = contentIds.slice(offset, offset + 500);
    for (let from = 0; ; from += 1000) {
      const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id,content_id")
        .eq("source_lane", lane).eq("status", "skipped").in("content_id", batchIds)
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (result.error) throw jobTableError("スキップ済み候補を取得できませんでした", result.error);
      const rows = result.data ?? [];
      for (const row of rows) skippedIds.add(row.content_id);
      if (rows.length < 1000) break;
    }
  }
  return skippedIds;
}

async function getTerminalCandidateIds(contentIds: string[]) {
  const terminalIds = new Set<string>();
  for (let offset = 0; offset < contentIds.length; offset += 500) {
    const batchIds = contentIds.slice(offset, offset + 500);
    for (let from = 0; ; from += 1000) {
      const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id,content_id")
        .in("status", ["posted", "skipped"]).in("content_id", batchIds)
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (result.error) throw jobTableError("投稿済み・スキップ済み候補を取得できませんでした", result.error);
      const rows = result.data ?? [];
      for (const row of rows) terminalIds.add(row.content_id);
      if (rows.length < 1000) break;
    }
  }
  return terminalIds;
}
async function getRecentlyPostedPopularIds(contentIds: string[]) {
  if (!contentIds.length) return new Set<string>();
  const cutoff = new Date(Date.now() - AMATEUR_X_POSTED_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const postedJobs: Array<{ content_id: string; posted_at: string | null; created_at: string | null }> = [];
  for (let from = 0; ; from += 1000) {
    const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs")
      .select("content_id,posted_at,created_at")
      .eq("status", "posted")
      .in("content_id", contentIds)
      .or(`posted_at.gte.${cutoff},and(posted_at.is.null,created_at.gte.${cutoff})`)
      .range(from, from + 999);
    if (result.error) throw jobTableError("直近の投稿履歴を取得できませんでした", result.error);
    const batch = result.data ?? [];
    postedJobs.push(...batch);
    if (batch.length < 1000) break;
  }
  return getRecentlyPostedContentIds(postedJobs);
}

export async function getAmateurXCandidates(lane: "new_release" | "popular", page = 1) {
  const safePage = Math.max(1, Math.trunc(page));
  let orderedIds: string[];
  let total: number;
  let ranked = [] as Awaited<ReturnType<typeof getDmmFanzaAmateurPopularWorks>>;
  if (lane === "popular") {
    ranked = await getDmmFanzaAmateurPopularWorks(500);
    const rankedIds = ranked.map((item) => item.content_id);
    const [recentlyPostedIds, skippedIds] = await Promise.all([
      getRecentlyPostedPopularIds(rankedIds),
      getSkippedCandidateIds(rankedIds, lane),
    ]);
    orderedIds = rankedIds.filter((id) => !recentlyPostedIds.has(id) && !skippedIds.has(id));
    const works = await getWorksByIds(orderedIds);
    const idsWithMedia = orderedIds.filter((id) => {
      const work = works.get(id);
      return Boolean(work?.is_listed && work.mp4_status === "found" && work.mp4_url);
    });
    total = idsWithMedia.length;
    orderedIds = idsWithMedia.slice((safePage - 1) * AMATEUR_X_PAGE_SIZE, safePage * AMATEUR_X_PAGE_SIZE);
  } else {
    const startInclusive = tokyoDateOffset(-6);
    const endExclusive = tokyoDateOffset(1);
    const allWorks: AmateurWork[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = await supabaseAdmin.from("fanza_amateur_works")
        .select("content_id,title,api_date,mp4_url,mp4_status,is_listed,image_url,prices")
        .eq("is_listed", true).eq("mp4_status", "found").not("mp4_url", "is", null)
        .gte("api_date", startInclusive).lt("api_date", endExclusive)
        .order("api_date", { ascending: true }).order("content_id", { ascending: true })
        .range(from, from + 999);
      if (rows.error) throw new Error(`新作候補を取得できませんでした: ${rows.error.message}`);
      const batch = (rows.data ?? []) as AmateurWork[];
      allWorks.push(...batch);
      if (batch.length < 1000) break;
    }
    const terminalIds = await getTerminalCandidateIds(allWorks.map((work) => work.content_id));
    const visibleWorks = withoutSkippedAmateurXCandidates(allWorks, terminalIds);
    const from = (safePage - 1) * AMATEUR_X_PAGE_SIZE;
    const works = visibleWorks.slice(from, from + AMATEUR_X_PAGE_SIZE);
    total = visibleWorks.length;
    const selected = await getSelectedJobs(works.map((work) => work.content_id), lane);
    return {
      candidates: works.map((work) => ({ ...work, image: imageUrl(work.image_url), job: selected.get(work.content_id) ?? null })),
      total,
      page: safePage,
      hasMore: from + works.length < total,
    };
  }

  const works = await getWorksByIds(orderedIds);
  const rankById = new Map(ranked.map((item, index) => [item.content_id, index + 1]));
  const selected = await getSelectedJobs(orderedIds, "popular");
  const candidates = orderedIds.flatMap((id) => {
    const work = works.get(id);
    if (!work) return [];
    return [{ ...work, image: imageUrl(work.image_url), rank: rankById.get(id) ?? null, job: selected.get(id) ?? null }];
  });
  return { candidates, total, page: safePage, hasMore: safePage * AMATEUR_X_PAGE_SIZE < total };
}

async function loadEligibleWork(contentId: string) {
  const result = await supabaseAdmin.from("fanza_amateur_works")
    .select("content_id,title,api_date,mp4_url,mp4_status,is_listed,image_url,prices,raw_item")
    .eq("content_id", contentId).maybeSingle();
  if (result.error) throw new Error(`作品を取得できませんでした: ${result.error.message}`);
  const work = result.data as AmateurWork | null;
  if (!work || !work.is_listed || work.mp4_status !== "found" || !work.mp4_url) throw new Error("MP4補完済みの掲載中作品だけ選択できます。");
  return work;
}

async function loadEligibleCandidateWork(contentId: string, lane: "new_release" | "popular") {
  const work = await loadEligibleWork(contentId);
  if (lane === "new_release") {
    const date = work.api_date?.slice(0, 10) ?? "";
    if (date < tokyoDateOffset(-6) || date >= tokyoDateOffset(1)) throw new Error("直近7日間の新作候補ではありません。");
    if ((await getTerminalCandidateIds([contentId])).has(contentId)) throw new Error("この作品はすでに投稿済みまたはスキップ済みです。");
  } else {
    const top500 = await getDmmFanzaAmateurPopularWorks(500);
    if (!top500.some((item) => item.content_id === contentId)) throw new Error("人気動画TOP500の候補ではありません。");
    const recentlyPostedIds = await getRecentlyPostedPopularIds([contentId]);
    if (recentlyPostedIds.has(contentId)) throw new Error("投稿から30日以内の作品は人気動画候補に追加できません。");
  }
  return work;
}

export async function getAmateurXDashboard(lane: "new_release" | "popular", page = 1) {
  const [candidatePage, jobsResult, historyResult] = await Promise.all([
    getAmateurXCandidates(lane, page),
    supabaseAdmin.from("fanza_amateur_x_post_jobs").select(JOB_FIELDS).eq("status", "pending")
      .order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("fanza_amateur_x_post_jobs").select(JOB_FIELDS).in("status", ["posted", "skipped"])
      .order("created_at", { ascending: false }).limit(100),
  ]);
  if (jobsResult.error) throw jobTableError("投稿履歴を取得できませんでした", jobsResult.error);
  if (historyResult.error) throw jobTableError("投稿履歴を取得できませんでした", historyResult.error);
  const jobs = (jobsResult.data ?? []) as unknown as Job[];
  const history = (historyResult.data ?? []) as unknown as Job[];
  const works = await getWorksByIds([...new Set([...jobs, ...history].map((job) => job.content_id))]);
  const decorateJob = (job: Job) => {
    const work = works.get(job.content_id) ?? null;
    const legacyTrackingKey = job.status === "pending" && work
      ? getLegacyAmateurXReplyTrackingKey(job.reply_text, job.content_id)
      : null;
    return {
      ...job,
      ...(legacyTrackingKey && work ? { reply_text: postCopy(work).replyText } : {}),
      work,
      image: imageUrl(work?.image_url),
    };
  };
  return {
    ...candidatePage,
    jobs: jobs.map(decorateJob),
    history: history.map(decorateJob),
  };
}

export async function createAmateurXJob(contentId: string, lane: "new_release" | "popular") {
  const work = await loadEligibleCandidateWork(contentId, lane);
  const existingPending = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id")
    .eq("content_id", contentId).eq("status", "pending").limit(1).maybeSingle();
  if (existingPending.error) throw jobTableError("共有投稿リストの重複を確認できませんでした", existingPending.error);
  if (existingPending.data) return { ok: false, error: "この作品はすでに投稿リストにあります。" };
  const texts = postCopy(work);
  const inserted = await supabaseAdmin.from("fanza_amateur_x_post_jobs")
    .insert({ account_handle: AMATEUR_X_SHARED_QUEUE_ACCOUNT, content_id: contentId, source_lane: lane, status: "pending", ...amateurXPostJobTextColumns(texts) })
    .select(JOB_FIELDS).single();
  if (inserted.error?.code === "23505") return { ok: false, error: "共有投稿リストにはすでに追加されています。" };
  if (inserted.error) throw jobTableError("投稿準備を保存できませんでした", inserted.error);
  return { ok: true, job: inserted.data as unknown as Job };
}

export async function skipAmateurXCandidate(contentId: string, lane: "new_release" | "popular") {
  const work = await loadEligibleCandidateWork(contentId, lane);
  const existingPending = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id")
    .eq("content_id", contentId).eq("status", "pending").limit(1).maybeSingle();
  if (existingPending.error) throw jobTableError("共有投稿リストの状態を確認できませんでした", existingPending.error);
  if (existingPending.data) return { ok: false, error: "この作品は投稿リストにあります。投稿するリストからスキップしてください。" };
  const texts = postCopy(work);
  const inserted = await supabaseAdmin.from("fanza_amateur_x_post_jobs")
    .insert({ account_handle: AMATEUR_X_SHARED_QUEUE_ACCOUNT, content_id: contentId, source_lane: lane, status: "skipped", ...amateurXPostJobTextColumns(texts) })
    .select(JOB_FIELDS).single();
  if (inserted.error?.code === "23505") return { ok: false, error: "この作品はすでに投稿済みまたはスキップ済みです。リストを更新してください。" };
  if (inserted.error) throw jobTableError("スキップを保存できませんでした", inserted.error);
  return { ok: true, job: inserted.data as unknown as Job };
}

export async function updateAmateurXJobText(jobId: number, mainText: string, replyText: string) {
  if (!mainText.trim() || mainText.length > 280 || !replyText.trim() || replyText.length > 280) throw new Error("本文と自己リプは1〜280文字で入力してください。");
  const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs").update({ main_text: mainText, reply_text: replyText })
    .eq("id", jobId).eq("status", "pending").select("id").maybeSingle();
  if (result.error) throw jobTableError("投稿文を保存できませんでした", result.error);
  if (!result.data) throw new Error("更新対象の投稿候補がありません。");
  return { ok: true };
}

export async function updateAmateurXJobStatus(jobId: number, status: "posted" | "skipped", xPostUrl?: string, mainText?: string, replyText?: string) {
  const loaded = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("id,status")
    .eq("id", jobId).maybeSingle();
  if (loaded.error) throw jobTableError("投稿候補を確認できませんでした", loaded.error);
  if (!loaded.data || loaded.data.status !== "pending") throw new Error("投稿候補はすでに処理済みです。");
  if (status === "posted" && (!mainText?.trim() || mainText.length > 280 || !replyText?.trim() || replyText.length > 280)) throw new Error("本文と自己リプを確認してから投稿済みにしてください。");
  const postUrl = xPostUrl?.trim() ?? "";
  const postedAccount = postUrl ? getXPostAccountHandle(postUrl) : null;
  if (postUrl && !postedAccount) throw new Error("X投稿URLの形式が正しくありません。");
  const update = supabaseAdmin.from("fanza_amateur_x_post_jobs")
    .update(amateurXPostJobStatusColumns({ status, xPostUrl: postUrl, postedAt: new Date().toISOString(), mainText, replyText }))
    .eq("id", jobId).eq("status", "pending");
  const result = await update.select("id").maybeSingle();
  if (result.error) throw jobTableError("投稿状態を保存できませんでした", result.error);
  if (!result.data) throw new Error("投稿候補の状態が変わっています。画面を更新してください。");
  return { ok: true };
}

export async function getAmateurXJobVideo(jobId: number, trimStartSeconds: number, trimEndSeconds: number | null = null) {
  const result = await supabaseAdmin.from("fanza_amateur_x_post_jobs").select("content_id,status")
    .eq("id", jobId).maybeSingle();
  if (result.error) throw jobTableError("動画対象を確認できませんでした", result.error);
  if (!result.data || result.data.status !== "pending") throw new Error("動画を準備できる投稿候補がありません。");
  const work = await loadEligibleWork(result.data.content_id);
  const source = new URL(work.mp4_url!);
  const allowedDomains = ["dmm.co.jp", "dmm.com", "fanza.co.jp"];
  if (source.protocol !== "https:" || !allowedDomains.some((domain) => source.hostname === domain || source.hostname.endsWith(`.${domain}`))) throw new Error("公式DMM/FANZA動画URLではありません。");
  const trimmed = await trimVideoForX({ sourceUrl: source.toString(), trimStartSeconds, trimEndSeconds });
  const filenameId = result.data.content_id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
  return { file: trimmed.file, dir: trimmed.dir, filename: `amateur-${filenameId}.mp4` };
}

