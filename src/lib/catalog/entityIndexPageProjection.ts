import { isEntityIndexable } from "./entityIndexQuality";
import type { EntityIndexKind, EntityIndexSummary } from "./entityIndexSummaries";
import { getPaginationItems } from "./pagination";

export type EntityIndexPageKind = Extract<EntityIndexKind, "genre" | "maker">;

export type EntityIndexPageParams = {
  q?: string;
  page?: string;
  sort?: string;
};

export type EntityIndexPageControls = {
  query: string;
  page: number;
  sort: string;
};

export function parseEntityIndexPageParams(params: EntityIndexPageParams): EntityIndexPageControls {
  const query = (params.q ?? "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  return { query, page, sort: params.sort ?? "count-desc" };
}

export function buildEntityIndexPageProjection(
  summaries: EntityIndexSummary[],
  kind: EntityIndexPageKind,
  controls: EntityIndexPageControls,
) {
  const ranked = summaries.filter((summary) => isEntityIndexable(kind, summary));
  const normalizedQuery = controls.query.toLocaleLowerCase("ja");
  const filtered = controls.query
    ? ranked.filter((item) => item.name.toLocaleLowerCase("ja").includes(normalizedQuery))
    : ranked;
  const sorted = [...filtered].sort((a, b) => controls.sort === "count-asc" ? a.count - b.count : b.count - a.count);
  const totalPages = Math.max(1, Math.ceil(sorted.length / 24));
  const currentPage = Math.min(controls.page, totalPages);

  return {
    currentPage,
    totalPages,
    paginationItems: getPaginationItems(totalPages, currentPage),
    visible: sorted.slice((currentPage - 1) * 24, currentPage * 24),
  };
}

export function buildEntityIndexPageHref(
  basePath: string,
  query: string,
  sort: string,
  target: number,
) {
  const next = new URLSearchParams();
  if (query) next.set("q", query);
  if (sort !== "count-desc") next.set("sort", sort);
  if (target > 1) next.set("page", String(target));
  return next.toString() ? `${basePath}?${next}` : basePath;
}
