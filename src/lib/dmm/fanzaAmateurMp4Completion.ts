import "server-only";

import type { Browser } from "playwright-core";
import { captureFanzaSampleMovieUrl } from "@/lib/playwright/captureFanzaSampleMovie";
import { closeBrowser, createBrowser } from "@/lib/playwright/browserManager";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BATCH_SIZE = 3;
const RUN_FIELDS = "id,run_type,status,target_count,processed_count,found_count,no_video_count,failed_attempt_count,last_error,started_at,updated_at,completed_at";
const WORK_FIELDS = "content_id,title,api_date,api_url,mp4_attempt_count,mp4_last_attempt_run_id";

export type FanzaAmateurMp4RunType = "daily_incremental" | "weekly_full";
export type FanzaAmateurMp4Run = {
  id: string;
  run_type: FanzaAmateurMp4RunType;
  status: "running" | "completed" | "failed";
  target_count: number;
  processed_count: number;
  found_count: number;
  no_video_count: number;
  failed_attempt_count: number;
  last_error: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
};

type Mp4Target = {
  content_id: string;
  title: string | null;
  api_date: string | null;
  api_url: string | null;
  mp4_attempt_count: number;
  mp4_last_attempt_run_id: string | null;
};

function jstDateOffset(days: number) {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function queryEligibleCount(runType: FanzaAmateurMp4RunType, runId?: string) {
  let query = supabaseAdmin
    .from("fanza_amateur_works")
    .select("content_id", { count: "exact", head: true })
    .eq("is_listed", true)
    .eq("mp4_status", "pending")
    .is("mp4_url", null)
    .lt("mp4_attempt_count", 3);
  if (runType === "daily_incremental") query = query.gte("api_date", jstDateOffset(-7)).lt("api_date", jstDateOffset(8));
  if (runId) query = query.or(`mp4_last_attempt_run_id.is.null,mp4_last_attempt_run_id.neq.${runId}`);
  const { count, error } = await query;
  if (error) throw new Error(`MP4補完対象件数を読み込めませんでした: ${error.message}`);
  return count ?? 0;
}

export async function getActiveFanzaAmateurMp4Run() {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_mp4_runs")
    .select(RUN_FIELDS)
    .eq("status", "running")
    .maybeSingle();
  if (error) throw new Error(`MP4補完の実行状態を読み込めませんでした: ${error.message}`);
  return data as FanzaAmateurMp4Run | null;
}

export async function getLatestFanzaAmateurMp4Run(runType: FanzaAmateurMp4RunType) {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_mp4_runs")
    .select(RUN_FIELDS)
    .eq("run_type", runType)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`MP4補完履歴を読み込めませんでした: ${error.message}`);
  return data as FanzaAmateurMp4Run | null;
}

export async function startFanzaAmateurMp4Run(runType: FanzaAmateurMp4RunType) {
  const active = await getActiveFanzaAmateurMp4Run();
  if (active) throw new Error("別のMP4補完が実行中です。進行中の処理を先に再開または完了してください。");

  const targetCount = await queryEligibleCount(runType);
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_mp4_runs")
    .insert({ run_type: runType, target_count: targetCount, status: "running" })
    .select(RUN_FIELDS)
    .single();
  if (error) {
    const racedRun = await getActiveFanzaAmateurMp4Run();
    if (racedRun) throw new Error("別のMP4補完が先に開始されました。進行中の処理を再開してください。");
    throw new Error(`MP4補完を開始できませんでした: ${error.message}`);
  }
  return data as FanzaAmateurMp4Run;
}

async function markExhaustedAsNoVideo(run: FanzaAmateurMp4Run) {
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_works")
    .update({
      mp4_status: "no_video",
      mp4_checked_at: new Date().toISOString(),
      mp4_last_error: "3回の取得試行でMP4リンクを確認できませんでした。",
    })
    .eq("mp4_status", "pending")
    .gte("mp4_attempt_count", 3)
    .is("mp4_url", null)
    .eq("mp4_last_attempt_run_id", run.id)
    .select("content_id");
  if (error) throw new Error(`3回失敗した作品を確定できませんでした: ${error.message}`);
  const newlyTerminal = data?.length ?? 0;
  if (!newlyTerminal) return run;
  return updateRun(run, {
    processed_count: run.processed_count + newlyTerminal,
    no_video_count: run.no_video_count + newlyTerminal,
  });
}

async function updateRun(run: FanzaAmateurMp4Run, increments: Partial<Pick<FanzaAmateurMp4Run, "processed_count" | "found_count" | "no_video_count" | "failed_attempt_count">> & { status?: "running" | "completed" | "failed"; last_error?: string | null; completed_at?: string | null }) {
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ["processed_count", "found_count", "no_video_count", "failed_attempt_count"] as const) {
    if (increments[key] !== undefined) changes[key] = run[key] + increments[key]!;
  }
  if (increments.status) changes.status = increments.status;
  if (increments.last_error !== undefined) changes.last_error = increments.last_error;
  if (increments.completed_at !== undefined) changes.completed_at = increments.completed_at;
  const { data, error } = await supabaseAdmin
    .from("fanza_amateur_mp4_runs")
    .update(changes)
    .eq("id", run.id)
    .eq("status", "running")
    .select(RUN_FIELDS)
    .single();
  if (error) throw new Error(`MP4補完の進捗を保存できませんでした: ${error.message}`);
  return data as FanzaAmateurMp4Run;
}

async function loadTargets(run: FanzaAmateurMp4Run): Promise<Mp4Target[]> {
  let query = supabaseAdmin
    .from("fanza_amateur_works")
    .select(WORK_FIELDS)
    .eq("is_listed", true)
    .eq("mp4_status", "pending")
    .is("mp4_url", null)
    .lt("mp4_attempt_count", 3)
    .or(`mp4_last_attempt_run_id.is.null,mp4_last_attempt_run_id.neq.${run.id}`)
    .order("api_date", { ascending: false, nullsFirst: false })
    .order("content_id", { ascending: true })
    .limit(BATCH_SIZE);
  if (run.run_type === "daily_incremental") query = query.gte("api_date", jstDateOffset(-7)).lt("api_date", jstDateOffset(8));
  const { data, error } = await query;
  if (error) throw new Error(`MP4補完対象を読み込めませんでした: ${error.message}`);
  return (data ?? []) as Mp4Target[];
}

async function attemptTarget(target: Mp4Target, run: FanzaAmateurMp4Run, browser: Browser) {
  const attemptCount = target.mp4_attempt_count + 1;
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("fanza_amateur_works")
    .update({ mp4_attempt_count: attemptCount, mp4_last_attempt_run_id: run.id })
    .eq("content_id", target.content_id)
    .eq("mp4_status", "pending")
    .eq("mp4_attempt_count", target.mp4_attempt_count)
    .is("mp4_url", null)
    .select("content_id")
    .maybeSingle();
  if (claimError) throw new Error(`作品の試行を記録できませんでした: ${claimError.message}`);
  if (!claimed) return { kind: "skipped" as const };

  let movieUrl: string | null = null;
  let failure: string | null = null;
  try {
    if (!target.api_url) throw new Error("APIの商品ページURLがありません。");
    movieUrl = await captureFanzaSampleMovieUrl(target.api_url, browser);
    if (!movieUrl) failure = `MP4リンク未検出（試行 ${attemptCount}/3）`;
  } catch (error) {
    failure = (error instanceof Error ? error.message : "MP4リンク取得に失敗しました。").slice(0, 500);
  }

  const checkedAt = new Date().toISOString();
  const found = Boolean(movieUrl);
  const terminal = !found && attemptCount >= 3;
  const { error: saveError } = await supabaseAdmin
    .from("fanza_amateur_works")
    .update({
      mp4_url: movieUrl,
      mp4_status: found ? "found" : terminal ? "no_video" : "pending",
      mp4_checked_at: checkedAt,
      mp4_last_error: found ? null : terminal ? "3回の取得試行でMP4リンクを確認できませんでした。" : failure,
    })
    .eq("content_id", target.content_id)
    .eq("mp4_last_attempt_run_id", run.id)
    .is("mp4_url", null);
  if (saveError) throw new Error(`取得したMP4情報を保存できませんでした: ${saveError.message}`);
  return { kind: found ? "found" as const : terminal ? "no_video" as const : "failed" as const };
}

export async function continueFanzaAmateurMp4Run(runId: string) {
  let run = await getActiveFanzaAmateurMp4Run();
  if (!run || run.id !== runId) throw new Error("進行中のMP4補完がありません。状態を再読み込みしてください。");

  run = await markExhaustedAsNoVideo(run);
  const targets = await loadTargets(run);
  if (targets.length === 0) {
    return updateRun(run, { status: "completed", completed_at: new Date().toISOString(), last_error: null });
  }

  const browser = await createBrowser();
  try {
    for (const target of targets) {
      const result = await attemptTarget(target, run, browser);
      if (result.kind === "skipped") continue;
      run = await updateRun(run, {
        processed_count: 1,
        found_count: result.kind === "found" ? 1 : 0,
        no_video_count: result.kind === "no_video" ? 1 : 0,
        failed_attempt_count: result.kind === "failed" || result.kind === "no_video" ? 1 : 0,
      });
    }
  } finally {
    await closeBrowser(browser);
  }

  run = await markExhaustedAsNoVideo(run);
  const remaining = await queryEligibleCount(run.run_type, run.id);
  if (remaining === 0) return updateRun(run, { status: "completed", completed_at: new Date().toISOString(), last_error: null });
  return run;
}
