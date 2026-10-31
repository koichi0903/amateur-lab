import type { FanzaAmateurBrowseSort } from "./fanzaAmateurCatalog";

export type AmateurEntityKind = "genre" | "maker";

export const AMATEUR_ENTITY_SORTS: Array<{ value: FanzaAmateurBrowseSort; label: string }> = [
  { value: "rank", label: "人気順" },
  { value: "date_desc", label: "発売日が新しい順" },
  { value: "date_asc", label: "発売日が古い順" },
  { value: "price", label: "価格が安い順" },
  { value: "review", label: "レビュー評価順" },
];

export function decodeAmateurEntityName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveAmateurEntitySort(requestedSort: string): FanzaAmateurBrowseSort {
  return AMATEUR_ENTITY_SORTS.some((item) => item.value === requestedSort)
    ? requestedSort as FanzaAmateurBrowseSort
    : "rank";
}

export function buildAmateurEntityBrowseRequest(
  kind: AmateurEntityKind,
  entityName: string,
  page: number,
  sort: FanzaAmateurBrowseSort,
) {
  return {
    page,
    ...(kind === "genre" ? { genre: entityName } : { maker: entityName }),
    sort,
  };
}

export function buildAmateurEntityPath(kind: AmateurEntityKind, entityName: string) {
  return `/amateur/${kind}/${encodeURIComponent(entityName)}`;
}

export function buildAmateurEntityPageHref(path: string, sort: FanzaAmateurBrowseSort, target: number) {
  const params = new URLSearchParams();
  if (sort !== "rank") params.set("sort", sort);
  if (target > 1) params.set("page", String(target));
  return params.size ? `${path}?${params.toString()}` : path;
}

export function getAmateurEntityPageCopy(
  kind: AmateurEntityKind,
  entityName: string,
  totalCount: number,
) {
  const kindLabel = kind === "genre" ? "ジャンル" : "メーカー";
  return {
    displayLabel: kind === "genre" ? "GENRE" : "MAKER",
    kindLabel,
    pageTitle: `${entityName}｜FANZA素人作品の${kindLabel}別一覧`,
    pageDescription: `${entityName}のFANZA素人作品を人気順などで掲載。登録作品数は${totalCount.toLocaleString("ja-JP")}件です。各作品の発売日・価格・サンプルを確認できます。`,
  };
}
