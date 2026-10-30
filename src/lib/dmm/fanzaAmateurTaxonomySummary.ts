import { asText, isRecord } from "@/lib/dmm/fanzaAmateurCatalogNormalize";

export type FanzaAmateurTaxonomyKind = "genre" | "maker";
export type FanzaAmateurTaxonomyImageCandidate = { contentId: string; imageUrl: string };
export type FanzaAmateurTaxonomySummary = {
  count: number;
  imageUrl: string | null;
  imageCandidates: FanzaAmateurTaxonomyImageCandidate[];
};
export type FanzaAmateurTaxonomyRow = {
  iteminfo: unknown;
  image_url: unknown;
  content_id: unknown;
};

function valuesForKind(iteminfo: unknown, kind: FanzaAmateurTaxonomyKind) {
  const itemInfo = isRecord(iteminfo) ? iteminfo : {};
  return Array.isArray(itemInfo[kind]) ? itemInfo[kind] as unknown[] : [];
}

function imageUrlForRow(value: unknown) {
  const image = isRecord(value) ? value : {};
  return asText(image.large) || asText(image.small) || asText(image.list) || null;
}

function shouldAddImageCandidate(
  kind: FanzaAmateurTaxonomyKind,
  imageUrl: string | null,
  summary: FanzaAmateurTaxonomySummary,
) {
  return kind === "genre" && Boolean(imageUrl) && summary.imageCandidates.length < 24 &&
    !summary.imageCandidates.some((candidate) => candidate.imageUrl === imageUrl);
}

function addTaxonomyValue(
  summaries: Map<string, FanzaAmateurTaxonomySummary>,
  value: unknown,
  row: FanzaAmateurTaxonomyRow,
  kind: FanzaAmateurTaxonomyKind,
  imageUrl: string | null,
) {
  if (!isRecord(value)) return;
  const name = asText(value.name);
  if (!name) return;

  const summary = summaries.get(name) ?? { count: 0, imageUrl: null, imageCandidates: [] };
  summary.count += 1;
  if (!summary.imageUrl && imageUrl) summary.imageUrl = imageUrl;
  if (shouldAddImageCandidate(kind, imageUrl, summary)) {
    summary.imageCandidates.push({ contentId: asText(row.content_id), imageUrl: imageUrl as string });
  }
  summaries.set(name, summary);
}

function addTaxonomyRow(
  summaries: Map<string, FanzaAmateurTaxonomySummary>,
  row: FanzaAmateurTaxonomyRow,
  kind: FanzaAmateurTaxonomyKind,
) {
  const imageUrl = imageUrlForRow(row.image_url);
  for (const value of valuesForKind(row.iteminfo, kind)) {
    addTaxonomyValue(summaries, value, row, kind, imageUrl);
  }
}

export function addFanzaAmateurTaxonomyRows(
  summaries: Map<string, FanzaAmateurTaxonomySummary>,
  rows: FanzaAmateurTaxonomyRow[],
  kind: FanzaAmateurTaxonomyKind,
) {
  for (const row of rows) addTaxonomyRow(summaries, row, kind);
}
