import type { AffiliateClickRow } from "./affiliateAnalyticsQueries";
import type { WorkPageViewRow } from "./affiliateAnalyticsInsights";

export function buildWorkFunnelRows(input: {
  clicks: AffiliateClickRow[];
  pageViews: WorkPageViewRow[];
  works: ReadonlyMap<number, { title: string }>;
  xPostTimes: ReadonlyMap<string, string>;
}) {
  const clickCountsByWorkSource = new Map<string, number>();
  for (const row of input.clicks) {
    const key = `${row.work_id}:${row.source_page}`;
    clickCountsByWorkSource.set(key, (clickCountsByWorkSource.get(key) ?? 0) + 1);
  }

  const funnelGroups = new Map<string, {
    workId: number;
    sourcePage: WorkPageViewRow["source_page"];
    pageViews: number;
    price: number | null;
    discountRate: number | null;
    discoveryScore: number | null;
    ranking: number | null;
    latestPostedAt: string | null;
  }>();
  for (const row of input.pageViews) {
    const key = `${row.work_id}:${row.source_page}`;
    const current = funnelGroups.get(key) ?? {
      workId: row.work_id,
      sourcePage: row.source_page,
      pageViews: 0,
      price: row.price,
      discountRate: row.discount_rate,
      discoveryScore: row.discovery_score,
      ranking: row.ranking,
      latestPostedAt: null,
    };
    current.pageViews += 1;
    current.price ??= row.price;
    current.discountRate ??= row.discount_rate;
    current.discoveryScore ??= row.discovery_score;
    current.ranking ??= row.ranking;
    const postedAt = row.x_post_key ? input.xPostTimes.get(row.x_post_key) ?? null : null;
    if (postedAt && (!current.latestPostedAt || new Date(postedAt).getTime() > new Date(current.latestPostedAt).getTime())) {
      current.latestPostedAt = postedAt;
    }
    funnelGroups.set(key, current);
  }

  return [...funnelGroups.entries()]
    .map(([key, group]) => {
      const fanzaClicks = clickCountsByWorkSource.get(key) ?? 0;
      return {
        ...group,
        title: input.works.get(group.workId)?.title ?? `作品ID ${group.workId}`,
        fanzaClicks,
        ctr: group.pageViews > 0 ? Math.round((fanzaClicks / group.pageViews) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.fanzaClicks - a.fanzaClicks || b.pageViews - a.pageViews)
    .slice(0, 25);
}
