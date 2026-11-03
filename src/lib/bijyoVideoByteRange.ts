export type ByteRange = { start: number; end: number };
export type BijyoVideoQuery =
  | { ok: true; jobId: number; workId: number | undefined; inline: boolean }
  | { ok: false; error: string };
export type ByteRangeBodyProjection = {
  body: Uint8Array;
  status: 200 | 206 | 416;
  contentRange: string | null;
};

export function parseBijyoVideoQueryParams(searchParams: URLSearchParams): BijyoVideoQuery {
  const jobId = Number(searchParams.get("jobId"));
  if (!Number.isSafeInteger(jobId) || jobId <= 0) return { ok: false, error: "jobIdが不正です。" };
  const workIdValue = searchParams.get("workId");
  const workId = workIdValue == null ? undefined : Number(workIdValue);
  if (workId !== undefined && (!Number.isSafeInteger(workId) || workId <= 0)) {
    return { ok: false, error: "workIdが不正です。" };
  }
  return { ok: true, jobId, workId, inline: searchParams.get("preview") === "1" };
}

function parseSuffixRange(suffix: string, size: number): ByteRange | null {
  const suffixLength = Number(suffix);
  if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
  return { start: Math.max(0, size - suffixLength), end: size - 1 };
}

function parseExplicitRange(startValue: string, endValue: string, size: number): ByteRange | null {
  const start = Number(startValue);
  const end = endValue ? Number(endValue) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

export function parseByteRange(value: string | null, size: number): ByteRange | null {
  if (!value?.startsWith("bytes=") || size <= 0) return null;
  const [raw] = value.slice(6).split(",");
  const match = /^(\d*)-(\d*)$/.exec(raw.trim());
  if (!match || (!match[1] && !match[2])) return null;
  return match[1]
    ? parseExplicitRange(match[1], match[2], size)
    : parseSuffixRange(match[2], size);
}

export function projectByteRangeBody(bytes: Uint8Array, value: string | null): ByteRangeBodyProjection {
  const range = parseByteRange(value, bytes.byteLength);
  if (!range) {
    return {
      body: bytes,
      status: value === null ? 200 : 416,
      contentRange: value === null ? null : `bytes */${bytes.byteLength}`,
    };
  }
  const body = bytes.subarray(range.start, range.end + 1);
  return {
    body,
    status: 206,
    contentRange: `bytes ${range.start}-${range.end}/${bytes.byteLength}`,
  };
}
