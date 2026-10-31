const MAX_ACTRESS_URL_LENGTH = 2048;
export const MAX_URLS_PER_INSPECTION_REQUEST = 635;

export type GoogleUrlInspectionUrlsValidation =
  | { ok: true; urls: string[] }
  | { ok: false; error: string };

export function validateGoogleUrlInspectionUrls(value: unknown): GoogleUrlInspectionUrlsValidation {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_URLS_PER_INSPECTION_REQUEST) {
    return { ok: false, error: `urlsには1〜${MAX_URLS_PER_INSPECTION_REQUEST}件を指定してください。` };
  }

  const normalizedUrls = value.map(normalizeActressUrl);
  if (normalizedUrls.some((url) => !url)) {
    return { ok: false, error: "https://hakkutsu-lab.com/actress/{slug} のURLだけを指定できます。" };
  }
  const urls = normalizedUrls as string[];
  if (new Set(urls).size !== urls.length) return { ok: false, error: "URLの重複は指定できません。" };
  return { ok: true, urls };
}

export function normalizeActressUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_ACTRESS_URL_LENGTH) return null;

  try {
    const url = new URL(value);
    if (!isCanonicalSecureOrigin(url) || !isSingleActressSlug(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isCanonicalSecureOrigin(url: URL) {
  return url.protocol === "https:"
    && url.hostname === "hakkutsu-lab.com"
    && !url.port
    && !url.username
    && !url.password
    && !url.search
    && !url.hash;
}

function isSingleActressSlug(pathname: string) {
  if (!pathname.startsWith("/actress/")) return false;
  const slug = pathname.slice("/actress/".length);
  return slug.length > 0 && !slug.includes("/");
}
