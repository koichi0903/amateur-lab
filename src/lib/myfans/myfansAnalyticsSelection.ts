import type { MyfansApprovedMedia } from "./myfansAnalyticsTypes";

type MediaSelectionRow = {
  approved_media_id?: number | null;
  approved_media_name?: string;
  affiliate_media_id?: string;
};

function matchesMediaName(rowName: string | undefined, media: Pick<MyfansApprovedMedia, "media_name"> | null) {
  if (!media) return true;
  return Boolean(rowName && rowName === media.media_name);
}

export function filterBySelectedMedia<T extends MediaSelectionRow>(
  rows: T[],
  selectedMedia: Pick<MyfansApprovedMedia, "id" | "media_name" | "affiliate_media_id"> | null,
) {
  if (!selectedMedia) return rows;
  return rows.filter((row) =>
    row.approved_media_id === selectedMedia.id ||
    matchesMediaName(row.approved_media_name, selectedMedia) ||
    Boolean(row.affiliate_media_id && row.affiliate_media_id === selectedMedia.affiliate_media_id),
  );
}

export function selectMyfansAnalyticsRows<
  TProduct extends MediaSelectionRow & { id: number },
  TPost extends MediaSelectionRow & { product_id: number | null },
  TConversion extends { approved_media_id?: number | null; product_id: number | null },
  TQuoteCandidate extends { approved_media_id: number | null },
  TLinkageEvidence extends { approved_media_id?: number | null; diagnostic_mode?: boolean },
  TDailyPlan extends { approved_media_id: number | null },
  TDaily extends { approved_media_id?: number | null },
  TXAccountMetric extends { approved_media_id: number },
>({
  allProducts,
  allPosts,
  allConversions,
  clickRows,
  dailyRows,
  xAccountMetrics,
  quoteCandidates: allQuoteCandidates,
  productLinkageEvidence: linkageEvidenceRows,
  dailyPlans: allDailyPlans,
  selectedMedia,
}: {
  allProducts: TProduct[];
  allPosts: TPost[];
  allConversions: TConversion[];
  clickRows: Array<{ approved_media_id?: number | null }>;
  dailyRows: TDaily[];
  xAccountMetrics: TXAccountMetric[];
  quoteCandidates: TQuoteCandidate[];
  productLinkageEvidence: TLinkageEvidence[];
  dailyPlans: TDailyPlan[];
  selectedMedia: Pick<MyfansApprovedMedia, "id" | "media_name" | "affiliate_media_id"> | null;
}) {
  const products = selectedMedia?.id === 5 ? allProducts : filterBySelectedMedia(allProducts, selectedMedia);
  const productIds = new Set(products.map((product) => product.id));
  const quoteCandidates = allQuoteCandidates.filter((row) =>
    !selectedMedia || selectedMedia.id === 5 || row.approved_media_id === selectedMedia.id || row.approved_media_id === null,
  );
  const allProductLinkageEvidence = linkageEvidenceRows.filter((row) =>
    !selectedMedia || row.approved_media_id === selectedMedia.id,
  );
  const productLinkageEvidence = allProductLinkageEvidence.filter((row) => row.diagnostic_mode !== true);
  const diagnosticProductLinkageEvidence = allProductLinkageEvidence.filter((row) => row.diagnostic_mode === true);
  const dailyPlans = allDailyPlans.filter((row) => !selectedMedia || row.approved_media_id === selectedMedia.id);
  const posts = allPosts
    .filter((post) => !selectedMedia || post.approved_media_id === selectedMedia.id)
    .filter((post) => !post.product_id || productIds.has(post.product_id));
  const conversions = allConversions.filter((conversion) =>
    (!selectedMedia || conversion.approved_media_id === selectedMedia.id) &&
    (!conversion.product_id || productIds.has(conversion.product_id)),
  );
  const clicks30d = clickRows.filter((row) => !selectedMedia || row.approved_media_id === selectedMedia.id).length;
  const daily = dailyRows.filter((row) => !selectedMedia || row.approved_media_id === selectedMedia.id);
  const selectedXAccountMetrics = xAccountMetrics.filter((row) => !selectedMedia || row.approved_media_id === selectedMedia.id);

  return {
    products,
    quoteCandidates,
    productLinkageEvidence,
    diagnosticProductLinkageEvidence,
    dailyPlans,
    posts,
    conversions,
    clicks30d,
    daily,
    xAccountMetrics: selectedXAccountMetrics,
  };
}
