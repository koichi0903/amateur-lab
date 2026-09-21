import { NextResponse } from "next/server";
import { summarizeMyfansQuoteRefreshItems } from "@/lib/myfansQuoteRefreshSummary";
import { evaluateMyfansSourceValue } from "@/lib/myfansSourceValue";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MAX_MYFANS_ACCOUNTS_PER_RUN, MYFANS_COLLECTION_KEY, selectCollectionAccounts } from "@/lib/myfansCollectionRotation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;
const REPLACED_BY_NEW_JOB = "REPLACED_BY_NEW_JOB: 新しい一括更新で置き換えました。";

function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBatchSize(value: unknown) {
  return Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, Math.max(1, Math.round(numberValue(value, MAX_MYFANS_ACCOUNTS_PER_RUN))));
}

function normalizeQueueLimit(value: unknown) {
  const parsed = Math.round(numberValue(value, 0));
  return parsed > 0 ? Math.min(1000, parsed) : null;
}

function normalizeXProfileUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/?$/);
  return match ? `https://x.com/${match[1]}` : "";
}

function normalizeTargetedCreatorIds(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return [...new Set(value.map((item) => Math.round(Number(item))).filter((item) => Number.isSafeInteger(item) && item > 0))].slice(0, 5);
}

async function targetedCreatorRecommendations(approvedMediaId: number | null) {
  let productsQuery = supabaseAdmin
    .from("myfans_products")
    .select("id,creator_id,title,source_x_url,creator_x_url")
    .not("creator_id", "is", null)
    .limit(1000);
  if (approvedMediaId) productsQuery = productsQuery.or(`approved_media_id.eq.${approvedMediaId},approved_media_id.is.null`);
  const { data: products, error: productsError } = await productsQuery;
  if (productsError) throw productsError;
  const productRows = (products ?? []).filter((row) => Number.isSafeInteger(row.creator_id));
  const creatorIds = [...new Set(productRows.map((row) => Number(row.creator_id)))];
  if (!creatorIds.length) return { candidates: [], reason: "eligible creator/product linkageなし" };
  const [{ data: creators, error: creatorsError }, { data: quotes, error: quotesError }] = await Promise.all([
    supabaseAdmin.from("myfans_creators").select("id,display_name,creator_x_url,is_active").in("id", creatorIds).eq("is_active", true),
    supabaseAdmin.from("myfans_quote_candidates").select("id,creator_id,text_excerpt,posted_at,collected_at,media_type,media_permalink,quote_visual_ready,visual_analysis_status,views,likes,reposts,replies,is_repost,is_reply,is_quote,last_used_at,cooldown_until").in("creator_id", creatorIds).order("collected_at", { ascending: false }).limit(5000),
  ]);
  if (creatorsError) throw creatorsError;
  if (quotesError) throw quotesError;
  const productCount = new Map<number, number>();
  for (const product of productRows) productCount.set(Number(product.creator_id), (productCount.get(Number(product.creator_id)) ?? 0) + 1);
  const freshPassCreators = new Set<number>();
  for (const quote of quotes ?? []) {
    const age = quote.collected_at ? (Date.now() - new Date(quote.collected_at).getTime()) / 86_400_000 : null;
    const source = evaluateMyfansSourceValue({ text: quote.text_excerpt ?? "", postedAt: quote.posted_at, collectedAt: quote.collected_at, mediaType: quote.media_type, mediaPermalink: quote.media_permalink, quoteVisualReady: quote.quote_visual_ready, visualAnalysisStatus: quote.visual_analysis_status, views: quote.views, likes: quote.likes, reposts: quote.reposts, replies: quote.replies, isRepost: quote.is_repost, isReply: quote.is_reply, isQuote: quote.is_quote });
    if (!quote.is_repost && !quote.last_used_at && !quote.cooldown_until && age !== null && age <= 7 && source.verdict === "PASS") freshPassCreators.add(Number(quote.creator_id));
  }
  const candidates = (creators ?? [])
    .map((creator) => ({
      creatorId: creator.id,
      displayName: creator.display_name,
      creatorXUrl: normalizeXProfileUrl(creator.creator_x_url),
      productCount: productCount.get(creator.id) ?? 0,
      need: freshPassCreators.has(creator.id) ? "既存fresh sourceあり。再収集不要" : "既存productにfresh Source Value PASSなし",
      eligible: !freshPassCreators.has(creator.id),
    }))
    .filter((row) => row.creatorXUrl && row.eligible)
    .sort((a, b) => b.productCount - a.productCount || a.creatorId - b.creatorId)
    .slice(0, 5);
  return { candidates, reason: candidates.length ? "既存productにfresh sourceがないcreatorを最大5件選定" : "既存productにfresh source不足の対象なし" };
}

async function refreshJobCounts(jobId: number) {
  const { data: items, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("status,collected_count,collection_state")
    .eq("job_id", jobId);
  if (error) throw error;

  const processed = (items ?? []).filter((item) => ["success", "failed", "skipped"].includes(item.status)).length;
  const success = (items ?? []).filter((item) => item.status === "success").length;
  const failed = (items ?? []).filter((item) => item.status === "failed").length;
  const completeThreadsFound = (items ?? []).filter((item) => Number(item.collected_count ?? 0) > 0).length;
  const noMatch = (items ?? []).filter((item) => item.collection_state === "NO_MATCH_THIS_RUN").length;
  const excludedNoPosts = (items ?? []).filter((item) => item.collection_state === "NO_POSTS").length;
  const excludedPrivate = (items ?? []).filter((item) => item.collection_state === "PRIVATE").length;
  const retryableErrors = (items ?? []).filter((item) => ["TEMP_ERROR", "THREAD_INCOMPLETE"].includes(item.collection_state)).length;
  const candidatesSaved = (items ?? []).reduce((total, item) => total + Number(item.collected_count ?? 0), 0);
  const runningItems = (items ?? []).some((item) => item.status === "running");
  const pendingItems = (items ?? []).some((item) => item.status === "pending");
  const currentJob = await getJob(jobId);
  const status = runningItems ? "running" : pendingItems ? currentJob?.status ?? "pending" : "completed";

  const { error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({
      status,
      processed_creators: processed,
      success_creators: success,
      failed_creators: failed,
      accounts_processed: processed,
      complete_threads_found: completeThreadsFound,
      candidates_saved: candidatesSaved,
      no_match: noMatch,
      excluded_no_posts: excludedNoPosts,
      excluded_private: excludedPrivate,
      retryable_errors: retryableErrors,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);
  if (updateError) throw updateError;
}

async function getJob(jobId: number) {
  const { data: job, error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  return job;
}

async function getActiveJob(approvedMediaId?: number | null) {
  let query = supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .in("status", ["pending", "running", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (approvedMediaId === null) query = query.is("approved_media_id", null);
  else if (approvedMediaId) query = query.eq("approved_media_id", approvedMediaId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function progress(jobId: number) {
  await refreshJobCounts(jobId);
  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (jobError) throw jobError;
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id,creator_id,creator_x_url,status,attempts,collected_count,top_score,error,processed_at,myfans_creators(display_name)")
    .eq("job_id", jobId)
    .order("id", { ascending: true });
  if (itemsError) throw itemsError;
  const skipped = (items ?? []).filter((item) => item.status === "skipped").length;
  const summary = summarizeMyfansQuoteRefreshItems(items ?? []);
  return { job, items: items ?? [], skippedCreators: skipped, summary };
}

async function createJob(payload: Record<string, unknown>) {
  const approvedMediaId = numberValue(payload.approvedMediaId, 0) || null;
  const batchSize = normalizeBatchSize(payload.batchSize);
  const queueLimit = Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, normalizeQueueLimit(payload.queueLimit) ?? batchSize);
  const existing = await getActiveJob(approvedMediaId);
  if (existing) {
    const existingProgress = await progress(existing.id);
    const canReplace =
      payload.replaceActive === true &&
      existingProgress.job.status === "pending" &&
      !existingProgress.job.started_at &&
      existingProgress.job.processed_creators === 0;
    if (!canReplace) return NextResponse.json(existingProgress);
    const { error: cancelError } = await supabaseAdmin
      .from("myfans_quote_refresh_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString(), last_error: REPLACED_BY_NEW_JOB })
      .eq("id", existing.id);
    if (cancelError) throw cancelError;
    await supabaseAdmin
      .from("myfans_quote_refresh_job_items")
      .update({ status: "skipped", error: REPLACED_BY_NEW_JOB, processed_at: new Date().toISOString() })
      .eq("job_id", existing.id)
      .eq("status", "pending");
  }
  const targetedCreatorIds = normalizeTargetedCreatorIds(payload.targetedCreatorIds);
  const { data: creators, error } = await supabaseAdmin
    .from("myfans_creators")
    .select("id,display_name,creator_x_url,is_active")
    .eq("is_active", true)
    .not("creator_x_url", "is", null)
    .neq("creator_x_url", "")
    .limit(1000);
  if (error) throw error;

  const creatorRows = (creators ?? [])
    .map((creator) => ({ ...creator, creator_x_url: normalizeXProfileUrl(creator.creator_x_url) }))
    .filter((creator) => creator.creator_x_url)
    .filter((creator) => !targetedCreatorIds.length || targetedCreatorIds.includes(creator.id));

  if (targetedCreatorIds.length && !creatorRows.length) return NextResponse.json({ error: "指定されたtarget creatorに有効なXプロフィールがありません。" }, { status: 400 });

  const orderedCreators = [...creatorRows].sort((a, b) => a.id - b.id);
  const { data: existingStates, error: stateError } = await supabaseAdmin
    .from("myfans_creator_collection_state")
    .select("creator_id,rotation_order,collection_enabled")
    .in("creator_id", orderedCreators.map((creator) => creator.id));
  if (stateError) throw stateError;
  const stateByCreator = new Map((existingStates ?? []).map((state) => [Number(state.creator_id), state]));
  const missingStates = orderedCreators
    .filter((creator) => !stateByCreator.has(creator.id))
    .map((creator) => ({ creator_id: creator.id, rotation_order: orderedCreators.findIndex((row) => row.id === creator.id) + 1, collection_enabled: true, state: "ELIGIBLE" }));
  if (missingStates.length) {
    const { error: insertStateError } = await supabaseAdmin.from("myfans_creator_collection_state").insert(missingStates);
    if (insertStateError) throw insertStateError;
    for (const state of missingStates) stateByCreator.set(state.creator_id, state);
  }
  const { data: cursor, error: cursorError } = await supabaseAdmin
    .from("myfans_collection_cursors")
    .select("cursor_order,cycle_no")
    .eq("collector_key", MYFANS_COLLECTION_KEY)
    .maybeSingle();
  if (cursorError) throw cursorError;
  const collectionAccounts = orderedCreators.map((creator) => {
    const state = stateByCreator.get(creator.id);
    return { creatorId: creator.id, rotationOrder: Number(state?.rotation_order ?? creator.id), collectionEnabled: state?.collection_enabled !== false };
  });
  const collectionRotation = selectCollectionAccounts(
    collectionAccounts,
    { cursorOrder: Number(cursor?.cursor_order ?? 0), cycleNo: Number(cursor?.cycle_no ?? 1) },
    targetedCreatorIds.length ? Math.min(MAX_MYFANS_ACCOUNTS_PER_RUN, targetedCreatorIds.length) : queueLimit,
  );
  const selectedIds = new Set(collectionRotation.selected.map((account) => account.creatorId));
  const prioritized = orderedCreators.filter((creator) => selectedIds.has(creator.id));
  if (targetedCreatorIds.length && !prioritized.length) return NextResponse.json({ error: "指定されたtarget creatorは収集対象外です。" }, { status: 400 });

  const selectionNote = `永続cursor ${collectionRotation.nextCursor.cursorOrder} まで進め、最大${MAX_MYFANS_ACCOUNTS_PER_RUN}アカウントを順番に処理。日付ではリセットしない。`;

  const { data: job, error: jobError } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .insert({
      approved_media_id: approvedMediaId,
      status: "pending",
      total_creators: prioritized.length,
      batch_size: batchSize,
      rotation_cooldown_days: 1,
      minimum_rotation_cooldown_days: 1,
      eligible_creators: collectionRotation.eligibleCount,
      cooldown_excluded_creators: 0,
      selection_mode: "strict",
      selection_note: selectionNote,
      collection_cycle_no: collectionRotation.nextCursor.cycleNo,
      cursor_before_order: Number(cursor?.cursor_order ?? 0),
      cursor_after_order: collectionRotation.nextCursor.cursorOrder,
      cycle_completed: collectionRotation.cycleCompleted,
      sensitive_gate_streak_limit: 3,
      sensitive_gate_streak: 0,
    })
    .select("*")
    .single();
  if (jobError) throw jobError;

  if (prioritized.length) {
    const { error: itemError } = await supabaseAdmin.from("myfans_quote_refresh_job_items").insert(
      prioritized.map((creator) => ({
        job_id: job.id,
        creator_id: creator.id,
        creator_x_url: creator.creator_x_url,
      })),
    );
    if (itemError) throw itemError;
  }

  const { error: cursorUpdateError } = await supabaseAdmin.from("myfans_collection_cursors").upsert({
    collector_key: MYFANS_COLLECTION_KEY,
    cursor_order: collectionRotation.nextCursor.cursorOrder,
    cycle_no: collectionRotation.nextCursor.cycleNo,
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "collector_key" });
  if (cursorUpdateError) throw cursorUpdateError;
  return NextResponse.json({ ...(await progress(job.id)), rotation: { ...collectionRotation, note: selectionNote, maxAccountsPerRun: MAX_MYFANS_ACCOUNTS_PER_RUN } });
}

async function nextItem(payload: Record<string, unknown>) {
  const requestedJobId = numberValue(payload.jobId, 0);
  const activeJob = requestedJobId ? await getJob(requestedJobId) : await getActiveJob(numberValue(payload.approvedMediaId, 0) || null);
  if (!activeJob) return NextResponse.json({ done: true, message: "実行中の更新キューはありません。" });
  if (activeJob.status === "paused") return NextResponse.json({ paused: true, job: activeJob });
  if (activeJob.status === "cancelled") return NextResponse.json({ done: true, job: activeJob });

  await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "running", started_at: activeJob.started_at ?? new Date().toISOString() })
    .eq("id", activeJob.id);

  const { data: stale } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id")
    .eq("job_id", activeJob.id)
    .eq("status", "running")
    .lt("processed_at", new Date(Date.now() - 5 * 60_000).toISOString());
  if (stale?.length) {
    await supabaseAdmin.from("myfans_quote_refresh_job_items").update({ status: "pending" }).in("id", stale.map((item) => item.id));
  }

  const { data: item, error } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .select("id,job_id,creator_id,creator_x_url,attempts,myfans_creators(display_name)")
    .eq("job_id", activeJob.id)
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!item) {
    await refreshJobCounts(activeJob.id);
    return NextResponse.json({ done: true, ...(await progress(activeJob.id)) });
  }

  const { data: running, error: updateError } = await supabaseAdmin
    .from("myfans_quote_refresh_job_items")
    .update({ status: "running", attempts: item.attempts + 1, processed_at: new Date().toISOString(), error: null })
    .eq("id", item.id)
    .select("id,job_id,creator_id,creator_x_url,attempts,myfans_creators(display_name)")
    .single();
  if (updateError) throw updateError;

  return NextResponse.json({ done: false, jobId: activeJob.id, batchSize: activeJob.batch_size, item: running });
}

async function startJob(payload: Record<string, unknown>) {
  const jobId = numberValue(payload.jobId, 0);
  if (!jobId) return NextResponse.json({ error: "jobIdが必要です。" }, { status: 400 });
  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "更新キューが見つかりません。" }, { status: 404 });
  if (!["pending", "paused", "running"].includes(job.status)) return NextResponse.json(await progress(jobId));
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status: "running", started_at: job.started_at ?? new Date().toISOString(), last_error: null })
    .eq("id", jobId);
  if (error) throw error;
  return NextResponse.json(await progress(jobId));
}

async function updateJobStatus(payload: Record<string, unknown>, status: "paused" | "running" | "cancelled") {
  const jobId = numberValue(payload.jobId, 0);
  if (!jobId) return NextResponse.json({ error: "jobIdが必要です。" }, { status: 400 });
  if (status === "cancelled") {
    const { error: itemError } = await supabaseAdmin
      .from("myfans_quote_refresh_job_items")
      .update({ status: "skipped", error: "一括更新をキャンセルしました。", processed_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .in("status", ["pending", "running"]);
    if (itemError) throw itemError;
  }
  const { error } = await supabaseAdmin
    .from("myfans_quote_refresh_jobs")
    .update({ status, completed_at: status === "cancelled" ? new Date().toISOString() : null })
    .eq("id", jobId);
  if (error) throw error;
  return NextResponse.json(await progress(jobId));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = numberValue(url.searchParams.get("jobId"), 0);
    const approvedMediaId = numberValue(url.searchParams.get("approvedMediaId"), 0) || null;
    if (url.searchParams.get("targeted") === "1") return NextResponse.json(await targetedCreatorRecommendations(approvedMediaId));
    const job = jobId ? await getJob(jobId) : await getActiveJob(approvedMediaId);
    if (!job) return NextResponse.json({ job: null, items: [] });
    return NextResponse.json(await progress(job.id));
  } catch (error) {
    return NextResponse.json({
      job: null,
      items: [],
      warning: error instanceof Error ? error.message : "進捗を取得できませんでした。",
    });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const action = cleanText(payload.action || "create");
    if (action === "create") return await createJob(payload);
    if (action === "start") return await startJob(payload);
    if (action === "next") return await nextItem(payload);
    if (action === "pause") return await updateJobStatus(payload, "paused");
    if (action === "resume") return await updateJobStatus(payload, "running");
    if (action === "cancel") return await updateJobStatus(payload, "cancelled");
    return NextResponse.json({ error: "未対応の操作です。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新キュー操作に失敗しました。" }, { status: 500 });
  }
}
