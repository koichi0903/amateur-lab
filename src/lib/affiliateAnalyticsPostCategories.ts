import { X_CATEGORY_LABELS, inferXPostKeyFromPageViews, roundOne, type WorkPageViewRow } from "./affiliateAnalyticsInsights";
import type { AffiliateClickRow, XPostCategoryRevenueRow } from "./affiliateAnalytics";

type CategoryPostLog = {
  postKey: string;
  category: XPostCategoryRevenueRow["category"];
};

type WorkTitle = { title: string };

type PostCategory = XPostCategoryRevenueRow["category"];

type CategoryGroup = {
  posts: Set<string>;
  xPageViews: number;
  xFanzaClicks: number;
  workViews: Map<number, number>;
  workClicks: Map<number, number>;
};

type BuildXPostCategoryRevenueInput = {
  categoryCutoff: number;
  pageViews: WorkPageViewRow[];
  clicks: AffiliateClickRow[];
  logs: ReadonlyMap<string, CategoryPostLog>;
  works: ReadonlyMap<number, WorkTitle>;
  fetchWorks: (workIds: number[]) => Promise<Map<number, WorkTitle>>;
};

function createCategoryGroup(): CategoryGroup {
  return {
    posts: new Set<string>(),
    xPageViews: 0,
    xFanzaClicks: 0,
    workViews: new Map<number, number>(),
    workClicks: new Map<number, number>(),
  };
}

function ensureCategoryGroup(groups: Map<PostCategory, CategoryGroup>, category: PostCategory) {
  const current = groups.get(category) ?? createCategoryGroup();
  groups.set(category, current);
  return current;
}

function getCategoryPageViews(pageViews: WorkPageViewRow[], cutoff: number) {
  return pageViews.filter((row) =>
    row.source_page === "x" && new Date(row.viewed_at).getTime() >= cutoff
  );
}

function getXPageViewsByWork(categoryPageViews: WorkPageViewRow[]) {
  const xPageViewsByWork = new Map<number, WorkPageViewRow[]>();
  for (const row of categoryPageViews.filter((view) => view.x_post_key)) {
    const views = xPageViewsByWork.get(row.work_id) ?? [];
    views.push(row);
    xPageViewsByWork.set(row.work_id, views);
  }
  for (const views of xPageViewsByWork.values()) {
    views.sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());
  }
  return xPageViewsByWork;
}

function getCategoryClicks(clicks: AffiliateClickRow[], cutoff: number) {
  return clicks.filter((row) =>
    row.source_page === "x" && new Date(row.clicked_at).getTime() >= cutoff
  );
}

function getLoggedCategory(postKey: string | null, logs: ReadonlyMap<string, CategoryPostLog>): PostCategory {
  return postKey ? logs.get(postKey)?.category ?? "unknown" : "unknown";
}

function addPageViewToCategory(
  groups: Map<PostCategory, CategoryGroup>,
  row: WorkPageViewRow,
  logs: ReadonlyMap<string, CategoryPostLog>,
) {
  const current = ensureCategoryGroup(groups, getLoggedCategory(row.x_post_key, logs));
  current.xPageViews += 1;
  if (row.x_post_key) current.posts.add(row.x_post_key);
  current.workViews.set(row.work_id, (current.workViews.get(row.work_id) ?? 0) + 1);
}

function addClickToCategory(
  groups: Map<PostCategory, CategoryGroup>,
  row: AffiliateClickRow,
  xPageViewsByWork: Map<number, WorkPageViewRow[]>,
  logs: ReadonlyMap<string, CategoryPostLog>,
) {
  const xPostKey = inferXPostKeyFromPageViews(row, xPageViewsByWork);
  const current = ensureCategoryGroup(groups, getLoggedCategory(xPostKey, logs));
  current.xFanzaClicks += 1;
  if (xPostKey) current.posts.add(xPostKey);
  current.workClicks.set(row.work_id, (current.workClicks.get(row.work_id) ?? 0) + 1);
}

function getCategoryWorkIds(groups: Map<PostCategory, CategoryGroup>) {
  return [...groups.values()].flatMap((group) => [
    ...group.workViews.keys(),
    ...group.workClicks.keys(),
  ]);
}

function buildCategoryResult(
  category: PostCategory,
  group: CategoryGroup,
  categoryWorks: Map<number, WorkTitle>,
  fallbackWorks: ReadonlyMap<number, WorkTitle>,
) {
  const workIds = [...new Set([...group.workViews.keys(), ...group.workClicks.keys()])];
  return {
    category,
    label: X_CATEGORY_LABELS[category],
    posts: group.posts.size,
    xPageViews: group.xPageViews,
    xFanzaClicks: group.xFanzaClicks,
    xCtr: group.xPageViews > 0 ? roundOne((group.xFanzaClicks / group.xPageViews) * 100) : 0,
    pvPerPost: group.posts.size > 0 ? roundOne(group.xPageViews / group.posts.size) : 0,
    clicksPerPost: group.posts.size > 0 ? roundOne(group.xFanzaClicks / group.posts.size) : 0,
    topWorks: workIds
      .map((workId) => {
        const xPageViews = group.workViews.get(workId) ?? 0;
        const xFanzaClicks = group.workClicks.get(workId) ?? 0;
        return {
          workId,
          title: categoryWorks.get(workId)?.title ?? fallbackWorks.get(workId)?.title ?? `作品ID ${workId}`,
          xPageViews,
          xFanzaClicks,
          xCtr: xPageViews > 0 ? roundOne((xFanzaClicks / xPageViews) * 100) : 0,
        };
      })
      .sort((a, b) => b.xFanzaClicks - a.xFanzaClicks || b.xPageViews - a.xPageViews)
      .slice(0, 5),
  };
}

export async function buildXPostCategoryRevenue(input: BuildXPostCategoryRevenueInput) {
  const categoryPageViews = getCategoryPageViews(input.pageViews, input.categoryCutoff);
  const xPageViewsByWork = getXPageViewsByWork(categoryPageViews);
  const categoryClicks = getCategoryClicks(input.clicks, input.categoryCutoff);
  const categoryGroups = new Map<PostCategory, CategoryGroup>();

  for (const log of input.logs.values()) ensureCategoryGroup(categoryGroups, log.category).posts.add(log.postKey);
  for (const row of categoryPageViews) addPageViewToCategory(categoryGroups, row, input.logs);
  for (const row of categoryClicks) addClickToCategory(categoryGroups, row, xPageViewsByWork, input.logs);

  const categoryWorkIds = getCategoryWorkIds(categoryGroups);
  const categoryWorks = await input.fetchWorks([...new Set(categoryWorkIds)]);
  return [...categoryGroups.entries()]
    .map(([category, group]) => buildCategoryResult(category, group, categoryWorks, input.works))
    .sort((a, b) => b.xFanzaClicks - a.xFanzaClicks || b.xPageViews - a.xPageViews);
}
