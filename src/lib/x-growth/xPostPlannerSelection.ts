import { fnv1aHash } from "../fnv1aHash";
import type { CandidateWork } from "./xPostPlannerData";
import type { XPostLog } from "../xPostLogs";

const ABSOLUTE_COOLDOWN_DAYS = 3;

function latestLogDays(workId: number, logs: XPostLog[], dayMs: number, now: () => number) {
  const latest = logs.find((log) => log.work_id === workId);
  return latest ? Math.max(0, Math.floor((now() - new Date(latest.posted_at).getTime()) / dayMs)) : Infinity;
}

function selectCooldownDays(
  absoluteEligible: CandidateWork[],
  logs: XPostLog[],
  limit: number,
  dayMs: number,
  now: () => number,
) {
  return [14, 7, 3].find((days) =>
    absoluteEligible.filter((work) => latestLogDays(work.id, logs, dayMs, now) >= days).length >= limit) ?? 3;
}

function orderEligibleWorks(
  works: CandidateWork[],
  logs: XPostLog[],
  cooldownDays: number,
  seed: string,
  dayMs: number,
  now: () => number,
) {
  return works
    .filter((work) => latestLogDays(work.id, logs, dayMs, now) >= cooldownDays)
    .sort((a, b) => fnv1aHash(`${seed}:${a.id}`) - fnv1aHash(`${seed}:${b.id}`) || (b.score ?? 0) - (a.score ?? 0));
}

function getCreatorIdentity(work: CandidateWork) {
  return {
    maker: work.maker?.trim() ?? "",
    actress: work.actress?.split(/[,、/]/)[0]?.trim() ?? "",
  };
}

function conflictsWithSelectedCreator(identity: ReturnType<typeof getCreatorIdentity>, makers: Set<string>, actresses: Set<string>) {
  return (identity.maker && makers.has(identity.maker)) || (identity.actress && actresses.has(identity.actress));
}

function rememberCreatorIdentity(identity: ReturnType<typeof getCreatorIdentity>, makers: Set<string>, actresses: Set<string>) {
  if (identity.maker) makers.add(identity.maker);
  if (identity.actress) actresses.add(identity.actress);
}

function selectDistinctEntities(eligible: CandidateWork[], limit: number) {
  const selected: CandidateWork[] = [];
  const makers = new Set<string>();
  const actresses = new Set<string>();
  for (const work of eligible) {
    const identity = getCreatorIdentity(work);
    if (conflictsWithSelectedCreator(identity, makers, actresses)) continue;
    selected.push(work);
    rememberCreatorIdentity(identity, makers, actresses);
    if (selected.length >= limit) break;
  }
  return selected;
}

function fillSelection(selected: CandidateWork[], eligible: CandidateWork[], limit: number) {
  for (const work of eligible) {
    if (selected.length >= limit) break;
    if (!selected.some((item) => item.id === work.id)) selected.push(work);
  }
}

export function selectWithDiversity(
  works: CandidateWork[],
  logs: XPostLog[],
  limit: number,
  seed: string,
  dayMs: number,
  now: () => number = Date.now,
) {
  const absoluteEligible = works.filter((work) => latestLogDays(work.id, logs, dayMs, now) >= ABSOLUTE_COOLDOWN_DAYS);
  const cooldownDays = selectCooldownDays(absoluteEligible, logs, limit, dayMs, now);
  const eligible = orderEligibleWorks(absoluteEligible, logs, cooldownDays, seed, dayMs, now);
  const selected = selectDistinctEntities(eligible, limit);
  fillSelection(selected, eligible, limit);
  return { selected, cooldownDays };
}
