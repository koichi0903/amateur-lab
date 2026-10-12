import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BIJYO_MANUAL_PAGE_SIZE, offsetPageBounds } from "@/lib/bijyoPagination";
import { buildBijyoReplyText } from "@/lib/bijyoReservedWorkflow";

const BIJYO_ACCOUNT = "bijyo1010";
const JOB_SELECT = "id,work_id,kind,slot_date,slot_index,scheduled_at,status,trim_start_seconds,trim_status,trim_reason,trim_failure_reason,main_text,reply_text,x_post_id,posted_at,failure_reason,skip_reason";

type Work = {
  id: number;
  title: string;
  stage: string;
  created_at: string;
  release_date: string;
  sample_movie_url: string;
  product_id: string | null;
};

type ManualJob = {
  id: number;
  work_id: number;
  kind: "auto" | "manual";
  slot_date: string;
  slot_index: number | null;
  scheduled_at: string;
  status: string;
  trim_start_seconds: number;
  trim_status: string;
  trim_reason: string;
  trim_failure_reason: string | null;
  main_text: string;
  reply_text: string;
  x_post_id: string | null;
  posted_at: string | null;
  failure_reason: string | null;
  skip_reason: string | null;
  work?: Work | null;
};

export type BijyoManualJobsPage = {
  jobs: ManualJob[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  error: string | null;
};

function elapsedMs(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

export async function getBijyoManualJobsPage(page = 1, traceId = crypto.randomUUID().slice(0, 8)): Promise<BijyoManualJobsPage> {
  const bounds = offsetPageBounds(page, BIJYO_MANUAL_PAGE_SIZE);
  const queryStartedAt = performance.now();
  console.info(`[bijyo-manual-jobs] trace=${traceId} stage=jobs-query-start page=${bounds.page}`);
  const result = await supabaseAdmin
    .from("bijyo_reserved_post_jobs")
    .select(JOB_SELECT, { count: "exact" })
    .eq("account_handle", BIJYO_ACCOUNT)
    .eq("kind", "manual")
    .in("status", ["pending", "trim_failed"])
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("scheduled_at", { ascending: false })
    .order("id", { ascending: false })
    .range(bounds.offset, bounds.offset + bounds.limit - 1);

  if (result.error) {
    const errorCode = typeof result.error.code === "string" ? result.error.code : "unknown";
    console.info(`[bijyo-manual-jobs] trace=${traceId} stage=jobs-query-done ms=${elapsedMs(queryStartedAt)} rows=0 error=true code=${errorCode}`);
    return { jobs: [], page: bounds.page, pageSize: BIJYO_MANUAL_PAGE_SIZE, total: 0, hasMore: false, error: "手動追加した投稿を取得できませんでした。少し待ってから再試行してください。" };
  }

  const rows = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
  const workIds = [...new Set(rows.map((row) => Number(row.work_id)).filter((id) => Number.isSafeInteger(id) && id > 0))];
  console.info(`[bijyo-manual-jobs] trace=${traceId} stage=jobs-query-done ms=${elapsedMs(queryStartedAt)} rows=${rows.length} total=${result.count ?? rows.length} error=false`);

  const worksStartedAt = performance.now();
  console.info(`[bijyo-manual-jobs] trace=${traceId} stage=works-query-start ids=${workIds.length}`);
  const worksResult = workIds.length
    ? await supabaseAdmin.from("works").select("id,title,stage,created_at,release_date,sample_movie_url,product_id").in("id", workIds)
    : { data: [], error: null };
  if (worksResult.error) {
    const errorCode = typeof worksResult.error.code === "string" ? worksResult.error.code : "unknown";
    console.info(`[bijyo-manual-jobs] trace=${traceId} stage=works-query-done ms=${elapsedMs(worksStartedAt)} rows=0 error=true code=${errorCode}`);
    return { jobs: [], page: bounds.page, pageSize: BIJYO_MANUAL_PAGE_SIZE, total: 0, hasMore: false, error: "手動追加した投稿の作品情報を取得できませんでした。少し待ってから再試行してください。" };
  }

  const works = (worksResult.data ?? []) as Work[];
  console.info(`[bijyo-manual-jobs] trace=${traceId} stage=works-query-done ms=${elapsedMs(worksStartedAt)} rows=${works.length} error=false`);
  const worksById = new Map(works.map((work) => [work.id, work]));
  const jobs = rows.map((row) => {
    const workId = Number(row.work_id);
    return { ...row, reply_text: buildBijyoReplyText(workId), work: worksById.get(workId) ?? null } as unknown as ManualJob;
  });
  const total = result.count ?? rows.length;

  return {
    jobs,
    page: bounds.page,
    pageSize: BIJYO_MANUAL_PAGE_SIZE,
    total,
    hasMore: bounds.offset + jobs.length < total,
    error: null,
  };
}
