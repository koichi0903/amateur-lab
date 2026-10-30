import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sourceKindFor } from "@/lib/xMediaAssets";
import { BIJYO_ACCOUNT } from "@/lib/bijyoConfig";
import type { BijyoJob } from "@/lib/bijyoReservedAutoPost";
import {
  BIJYO_RESERVED_REGISTRATION_WINDOW_MS,
  buildBijyoReplyText,
  isBijyoManualCandidate,
  isBijyoReservedQueueEligible,
  isBijyoReservedRegistrationRecent,
  tokyoDate,
  type RecentReleaseWork,
} from "@/lib/bijyoReservedWorkflow";
import { BIJYO_RESERVED_PAGE_SIZE, offsetPageBounds } from "@/lib/bijyoPagination";

export const HISTORY_PAGE_SIZE = 20;
const BIJYO_JOB_SELECT = "id,work_id,kind,slot_date,slot_index,scheduled_at,status,trim_start_seconds,trim_status,trim_reason,trim_failure_reason,main_text,reply_text,x_post_id,posted_at,failure_reason,skip_reason";

type Work = RecentReleaseWork & { stage: string; product_id: string | null };

function workIdsFromRows(rows: Array<Record<string, unknown>>) {
  return [...new Set(rows.map((row) => Number(row.work_id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
}

async function joinWorks(rows: Array<Record<string, unknown>>): Promise<{ jobs: BijyoJob[]; error: string | null }> {
  const workIds = workIdsFromRows(rows);
  const result = workIds.length
    ? await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,image_url,sample_movie_url,product_id").in("id", workIds)
    : { data: [], error: null };
  if (result.error) return { jobs: [], error: result.error.message };
  const byId = new Map(((result.data ?? []) as Work[]).map((work) => [work.id, work]));
  return {
    jobs: rows.map((row) => {
      const workId = Number(row.work_id);
      return { ...row, reply_text: buildBijyoReplyText(workId), work: byId.get(workId) ?? null };
    }) as unknown as BijyoJob[],
    error: null,
  };
}

export async function getBijyoHistoryPage(page = 1) {
  const bounds = offsetPageBounds(page, HISTORY_PAGE_SIZE);
  const result = await supabaseAdmin
    .from("bijyo_reserved_post_jobs")
    .select(BIJYO_JOB_SELECT)
    .eq("account_handle", BIJYO_ACCOUNT)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("scheduled_at", { ascending: false })
    .order("id", { ascending: false })
    .range(bounds.offset, bounds.offset + bounds.limit);
  if (result.error) return { jobs: [] as BijyoJob[], page: bounds.page, pageSize: HISTORY_PAGE_SIZE, hasMore: false, error: result.error.message };
  const fetched = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
  const hasMore = fetched.length > HISTORY_PAGE_SIZE;
  const joined = await joinWorks(fetched.slice(0, HISTORY_PAGE_SIZE));
  return { jobs: joined.jobs, page: bounds.page, pageSize: HISTORY_PAGE_SIZE, hasMore, error: joined.error };
}

async function jobWorkIds(workIds: number[]) {
  const batches: number[][] = [];
  for (let index = 0; index < workIds.length; index += 200) batches.push(workIds.slice(index, index + 200));
  const results = await Promise.all(batches.map((ids) => supabaseAdmin
    .from("bijyo_reserved_post_jobs")
    .select("work_id")
    .eq("account_handle", BIJYO_ACCOUNT)
    .in("work_id", ids)));
  const failed = results.find((result) => result.error);
  return failed?.error
    ? { workIds: [] as number[], error: failed.error.message }
    : { workIds: results.flatMap((result) => (result.data ?? []).map((row) => Number(row.work_id))), error: null };
}

export async function getBijyoReservedQueueWorks(page = 1, now = new Date()) {
  const bounds = offsetPageBounds(page, BIJYO_RESERVED_PAGE_SIZE);
  const today = tokyoDate(now);
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - BIJYO_RESERVED_REGISTRATION_WINDOW_MS).toISOString();
  const needed = bounds.offset + bounds.limit + 1;
  const eligible: Work[] = [];
  const batchSize = 500;
  let batchOffset = 0;

  while (eligible.length < needed) {
    const result = await supabaseAdmin.from("works")
      .select("id,title,stage,created_at,release_date,image_url,sample_movie_url,product_id")
      .eq("stage", "RESERVED")
      .gt("release_date", today)
      .gte("created_at", cutoff)
      .lte("created_at", nowIso)
      .not("sample_movie_url", "is", null)
      .neq("sample_movie_url", "")
      .order("release_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(batchOffset, batchOffset + batchSize - 1);
    if (result.error) return { works: [] as Work[], page: bounds.page, hasMore: false, error: result.error.message };
    const batch = (result.data ?? []) as Work[];
    if (!batch.length) break;
    const refs = await jobWorkIds(batch.map((work) => work.id));
    if (refs.error) return { works: [] as Work[], page: bounds.page, hasMore: false, error: refs.error };
    const used = new Set(refs.workIds);
    eligible.push(...batch.filter((work) =>
      sourceKindFor(work.sample_movie_url) === "official_sample"
      && !used.has(work.id)
      && isBijyoReservedQueueEligible(work.stage, work.release_date, today)
      && isBijyoReservedRegistrationRecent(work.created_at, now),
    ));
    batchOffset += batch.length;
    if (batch.length < batchSize) break;
  }

  const works = eligible.slice(bounds.offset, bounds.offset + bounds.limit).map((work) => ({
    ...work,
    manualEligible: isBijyoManualCandidate(work, { officialSample: true, hasExistingJob: false }),
  }));
  return { works, page: bounds.page, hasMore: eligible.length > bounds.offset + bounds.limit, error: null };
}
