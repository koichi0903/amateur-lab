export function bijyoManualIdempotencyKey(workId: number) {
  return `bijyo1010:manual:${workId}`;
}

export type BijyoJobStatus = "pending" | "posted" | "manual_posted" | "skipped" | "excluded" | "trim_failed";

export type Candidate = { id: number; created_at: string };
export type ExistingJob = { work_id: number; status: string; slot_index: number | null; slot_date?: string; kind: "auto" | "manual" };

export function tokyoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function tokyoDateFromIso(value: string) { return tokyoDate(new Date(value)); }

const TOKYO_DAY_MS = 86_400_000;
export const BIJYO_RESERVED_CANDIDATE_WINDOW_MS = 7 * TOKYO_DAY_MS;

export function bijyoReservedCandidateSince(now = new Date()) {
  return new Date(now.getTime() - BIJYO_RESERVED_CANDIDATE_WINDOW_MS).toISOString();
}

export function isBijyoReservedCandidate(work: { stage: string; created_at: string; release_date?: string | null }, now = new Date()) {
  return work.stage === "RESERVED"
    && Boolean(work.release_date)
    && Number.isFinite(Date.parse(work.created_at))
    && Date.parse(work.created_at) >= Date.parse(bijyoReservedCandidateSince(now));
}

export type ReleaseDateRange = { todayDate: string; startDate: string; endDate: string };

export type BijyoFutureEligibility = { eligible: boolean; reason: string | null };

function shiftTokyoDate(date: string, days: number) {
  return tokyoDate(new Date(new Date(`${date}T00:00:00+09:00`).getTime() + days * TOKYO_DAY_MS));
}

export function recentReleaseDateRange(now = new Date()): ReleaseDateRange {
  const todayDate = tokyoDate(now);
  return { todayDate, startDate: todayDate, endDate: shiftTokyoDate(todayDate, 7) };
}

export function evaluateBijyoFutureOperation(stage: string, releaseDate: string | null | undefined, dateRange: ReleaseDateRange): BijyoFutureEligibility {
  if (!releaseDate) return { eligible: false, reason: "発売日がありません。" };
  const date = releaseDate.slice(0, 10);
  if (date < dateRange.startDate) return { eligible: false, reason: "発売日が過去です。" };
  if (date > dateRange.endDate) return { eligible: false, reason: "発売日が今日から7日後を超えています。" };
  if (date === dateRange.todayDate && !["RESERVED", "NEW"].includes(stage)) return { eligible: false, reason: "本日の発売作品はNEWまたはRESERVEDだけが対象です。" };
  if (date !== dateRange.todayDate && stage !== "RESERVED") return { eligible: false, reason: "明日以降の発売作品はRESERVEDだけが対象です。" };
  return { eligible: true, reason: null };
}

export function isBijyoFutureOperationEligible(stage: string, releaseDate: string, dateRange: ReleaseDateRange) {
  return evaluateBijyoFutureOperation(stage, releaseDate, dateRange).eligible;
}

export type RecentReleaseWork = {
  id: number;
  title: string;
  stage: string;
  created_at: string;
  release_date: string;
  image_url: string | null;
  sample_movie_url: string;
  product_id: string | null;
};

export type RecentReleaseJob = { work_id: number; kind: string; slot_date: string; status: string };

export function filterRecentReleaseWorks(works: RecentReleaseWork[], jobs: RecentReleaseJob[], dateRange: ReleaseDateRange) {
  const excludedStatuses = new Set(["posted", "manual_posted", "skipped", "excluded"]);
  const excludedWorkIds = new Set(jobs.filter((job) => excludedStatuses.has(job.status)).map((job) => job.work_id));
  const assignedToday = new Set(jobs.filter((job) => job.kind === "auto" && job.slot_date === dateRange.todayDate).map((job) => job.work_id));
  const manualWorks = new Set(jobs.filter((job) => job.kind === "manual").map((job) => job.work_id));
  const seen = new Set<number>();
  return works
    .filter((work) => {
      const releaseDate = work.release_date.slice(0, 10);
      if (!evaluateBijyoFutureOperation(work.stage, releaseDate, dateRange).eligible || !work.sample_movie_url) return false;
      if (excludedWorkIds.has(work.id) || assignedToday.has(work.id) || manualWorks.has(work.id) || seen.has(work.id)) return false;
      seen.add(work.id);
      return true;
    })
    .sort((a, b) => a.release_date.slice(0, 10).localeCompare(b.release_date.slice(0, 10)) || b.created_at.localeCompare(a.created_at) || a.id - b.id);
}

export function isoAtTokyo(date: string, time: string) { return new Date(`${date}T${time}:00+09:00`).toISOString(); }

export function releaseLabel(value: string) {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(value);
  return match ? `${Number(match[1])}月${Number(match[2])}日` : value;
}

export function buildBijyoMainText(work: { title: string; release_date: string }) {
  return `【${releaseLabel(work.release_date)}発売】\n${work.title}`;
}

export function buildBijyoReplyText(workId: number) {
  return `👇作品の続き、セール価格推移はこちら\nhttps://amateur-lab.vercel.app/works/${workId}`;
}
