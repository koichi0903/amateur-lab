import type { AffiliateClickRow } from "./affiliateAnalyticsQueries";
import type { WorkPageViewRow } from "./affiliateAnalyticsInsights";

type WorkFunnelGroup = {
  workId: number;
  sourcePage: WorkPageViewRow["source_page"];
  pageViews: number;
  price: number | null;
  discountRate: number | null;
  discoveryScore: number | null;
  ranking: number | null;
  latestPostedAt: string | null;
};

function workSourceKey(workId: number, sourcePage: string) {
  return `${workId}:${sourcePage}`;
}

function countClicksByWorkSource(clicks: AffiliateClickRow[]) {
  const counts = new Map<string, number>();
  for (const row of clicks) {
    const key = workSourceKey(row.work_id, row.source_page);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function createWorkFunnelGroup(row: WorkPageViewRow): WorkFunnelGroup {
  return {
    workId: row.work_id,
    sourcePage: row.source_page,
    pageViews: 0,
    price: row.price,
    discountRate: row.discount_rate,
    discoveryScore: row.discovery_score,
    ranking: row.ranking,
    latestPostedAt: null,
  };
}

function groupForPageView(groups: Map<string, WorkFunnelGroup>, key: string, row: WorkPageViewRow) {
  const group = groups.get(key) ?? createWorkFunnelGroup(row);
  group.pageViews += 1;
  group.price ??= row.price;
  group.discountRate ??= row.discount_rate;
  group.discoveryScore ??= row.discovery_score;
  group.ranking ??= row.ranking;
  return group;
}

function postedAtForPageView(row: WorkPageViewRow, xPostTimes: ReadonlyMap<string, string>) {
  return row.x_post_key ? xPostTimes.get(row.x_post_key) ?? null : null;
}

function retainLatestPostedAt(group: WorkFunnelGroup, postedAt: string | null) {
  if (postedAt && (!group.latestPostedAt || new Date(postedAt).getTime() > new Date(group.latestPostedAt).getTime())) {
    group.latestPostedAt = postedAt;
  }
}

function groupWorkPageViews(pageViews: WorkPageViewRow[], xPostTimes: ReadonlyMap<string, string>) {
  const groups = new Map<string, WorkFunnelGroup>();
  for (const row of pageViews) {
    const key = workSourceKey(row.work_id, row.source_page);
    const group = groupForPageView(groups, key, row);
    retainLatestPostedAt(group, postedAtForPageView(row, xPostTimes));
    groups.set(key, group);
  }
  return groups;
}

function projectWorkFunnelRow(
  key: string,
  group: WorkFunnelGroup,
  clicksByWorkSource: ReadonlyMap<string, number>,
  works: ReadonlyMap<number, { title: string }>,
) {
  const fanzaClicks = clicksByWorkSource.get(key) ?? 0;
  return {
    ...group,
    title: works.get(group.workId)?.title ?? `作品ID ${group.workId}`,
    fanzaClicks,
    ctr: group.pageViews > 0 ? Math.round((fanzaClicks / group.pageViews) * 1000) / 10 : 0,
  };
}

export function buildWorkFunnelRows(input: {
  clicks: AffiliateClickRow[];
  pageViews: WorkPageViewRow[];
  works: ReadonlyMap<number, { title: string }>;
  xPostTimes: ReadonlyMap<string, string>;
}) {
  const clicksByWorkSource = countClicksByWorkSource(input.clicks);
  const funnelGroups = groupWorkPageViews(input.pageViews, input.xPostTimes);
  return [...funnelGroups.entries()]
    .map(([key, group]) => projectWorkFunnelRow(key, group, clicksByWorkSource, input.works))
    .sort((a, b) => b.fanzaClicks - a.fanzaClicks || b.pageViews - a.pageViews)
    .slice(0, 25);
}
