export function xGrowthMediaPreviewUrl(input: { workId: number; mediaType: string; mediaAssetId?: number | null }) {
  const params = new URLSearchParams({
    workId: String(input.workId),
    mediaType: input.mediaType,
  });
  if (input.mediaAssetId) params.set("assetId", String(input.mediaAssetId));
  if (input.mediaType === "sample_movie") params.set("preview", "1");
  return `/api/admin/x-growth/media/download?${params.toString()}`;
}

export function ensureXGrowthMediaPreviewUrl(value: string) {
  try {
    const url = new URL(value, "http://x-growth.local");
    if (url.pathname !== "/api/admin/x-growth/media/download" || url.searchParams.get("mediaType") !== "sample_movie") return value;
    url.searchParams.set("preview", "1");
    return value.startsWith("http://") || value.startsWith("https://") ? url.toString() : `${url.pathname}?${url.searchParams.toString()}`;
  } catch {
    return value;
  }
}

export function xGrowthMediaResponseHeaders(input: {
  contentType: string;
  contentLength?: string | null;
  contentRange?: string | null;
  acceptRanges?: string | null;
  preview: boolean;
  filename: string;
}) {
  const headers = new Headers({
    "Content-Type": input.contentType,
    "Cache-Control": "private, no-store",
  });
  if (!input.preview) headers.set("Content-Disposition", `attachment; filename="${input.filename}"`);
  if (input.contentLength) headers.set("Content-Length", input.contentLength);
  if (input.contentRange) headers.set("Content-Range", input.contentRange);
  if (input.acceptRanges) headers.set("Accept-Ranges", input.acceptRanges);
  return headers;
}
