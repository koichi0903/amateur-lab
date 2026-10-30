export type AmateurActressSitemapSummary = {
  name: string;
  work_count: number | string;
};

export function getAmateurActressSitemapPaths(totalPages: number): string[] {
  const pageCount = Number.isFinite(totalPages) ? Math.max(0, Math.trunc(totalPages)) : 0;
  return Array.from({ length: pageCount }, (_, index) => `/sitemaps/amateur-actress-${index + 1}.xml`);
}

export function getAmateurActressSitemapUrls(summaries: AmateurActressSitemapSummary[], siteUrl: string): string[] {
  return summaries
    .filter((summary) => summary.name.trim() && Number(summary.work_count) > 0)
    .map((summary) => `${siteUrl}/amateur/actress/${encodeURIComponent(summary.name)}`);
}
