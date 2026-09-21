export const BIJYO_DEFAULT_SLOTS = ["09:00", "13:00", "18:00", "22:00"] as const;

export type BijyoJobStatus = "pending" | "posted" | "manual_posted" | "skipped" | "excluded" | "trim_failed";

export type Candidate = { id: number; created_at: string };
export type ExistingJob = { work_id: number; status: string; slot_index: number | null; slot_date?: string; kind: "auto" | "manual" };

export function tokyoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function tokyoDateFromIso(value: string) { return tokyoDate(new Date(value)); }

const TOKYO_DAY_MS = 86_400_000;

export function recentReleaseDateRange(now = new Date()) {
  const endDate = tokyoDate(now);
  const startDate = tokyoDate(new Date(new Date(`${endDate}T00:00:00+09:00`).getTime() - 6 * TOKYO_DAY_MS));
  return { startDate, endDate };
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

export function filterRecentReleaseWorks(works: RecentReleaseWork[], jobs: RecentReleaseJob[], dateRange: { startDate: string; endDate: string }) {
  const excludedStatuses = new Set(["posted", "manual_posted", "skipped", "excluded"]);
  const excludedWorkIds = new Set(jobs.filter((job) => excludedStatuses.has(job.status)).map((job) => job.work_id));
  const assignedToday = new Set(jobs.filter((job) => job.kind === "auto" && job.slot_date === dateRange.endDate).map((job) => job.work_id));
  const manualWorks = new Set(jobs.filter((job) => job.kind === "manual").map((job) => job.work_id));
  const seen = new Set<number>();
  return works
    .filter((work) => {
      const releaseDate = work.release_date.slice(0, 10);
      if (work.stage !== "RESERVED" || !work.sample_movie_url || releaseDate < dateRange.startDate || releaseDate > dateRange.endDate) return false;
      if (excludedWorkIds.has(work.id) || assignedToday.has(work.id) || manualWorks.has(work.id) || seen.has(work.id)) return false;
      seen.add(work.id);
      return true;
    })
    .sort((a, b) => b.release_date.localeCompare(a.release_date) || b.created_at.localeCompare(a.created_at) || b.id - a.id);
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
  return `👇続きはこちら\nhttps://amateur-lab.vercel.app/works/${workId}`;
}

export function chooseNextCandidate(candidates: Candidate[], existingJobs: ExistingJob[]) {
  const used = new Set(existingJobs.map((job) => job.work_id));
  return candidates.find((candidate) => !used.has(candidate.id)) ?? null;
}

export function allocateTodaySlots(input: { date: string; candidates: Candidate[]; existingJobs: ExistingJob[]; scheduleTimes?: readonly string[] }) {
  const scheduleTimes = input.scheduleTimes ?? BIJYO_DEFAULT_SLOTS;
  const assigned = input.existingJobs.filter((job) => job.kind === "auto" && (!job.slot_date || job.slot_date === input.date) && !["excluded", "skipped"].includes(job.status));
  const used = new Set(input.existingJobs.filter((job) => job.status !== "excluded").map((job) => job.work_id));
  const ordered = [...input.candidates].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const fresh = ordered.filter((candidate) => tokyoDateFromIso(candidate.created_at) === input.date);
  const rollover = ordered.filter((candidate) => tokyoDateFromIso(candidate.created_at) !== input.date);
  const prioritized = [...fresh, ...rollover];
  const slots: Array<{ slotIndex: number; workId: number; scheduledAt: string }> = [];
  for (let slotIndex = 0; slotIndex < 4; slotIndex += 1) {
    if (assigned.some((job) => job.slot_index === slotIndex)) continue;
    const candidate = prioritized.find((item) => !used.has(item.id));
    if (!candidate) continue;
    used.add(candidate.id);
    slots.push({ slotIndex, workId: candidate.id, scheduledAt: isoAtTokyo(input.date, scheduleTimes[slotIndex] ?? BIJYO_DEFAULT_SLOTS[slotIndex]) });
  }
  return slots;
}

export function todayProgress(jobs: Array<{ slot_date: string; kind: string; status: string }>, date: string) {
  const posted = jobs.filter((job) => job.slot_date === date && job.kind === "auto" && ["posted", "manual_posted"].includes(job.status)).length;
  return { posted, target: 4, remaining: Math.max(0, 4 - posted), shortage: Math.max(0, 4 - jobs.filter((job) => job.slot_date === date && job.kind === "auto").length) };
}
