export function cleanText(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

export function numberValue(value: unknown) {
  const parsed = Number(cleanText(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function cleanAffiliateUrl(value: unknown) {
  const url = cleanText(value);
  return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+/.test(url) ? url : "";
}

export function cleanXStatusUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)/);
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
}

export function cleanDiagnosticStatusUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/i);
  return match ? `https://x.com/${match[1]}/status/${match[2]}` : "";
}

export function cleanXMediaPermalink(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/status\/(\d+)\/(photo|video)\/([1-9]\d*)/);
  return match ? `https://x.com/${match[1]}/status/${match[2]}/${match[3]}/${match[4]}` : "";
}

export function cleanValidationStatus(value: unknown) {
  return cleanText(value).replace(/[^a-z0-9_:-]/gi, "").slice(0, 80);
}

export function cleanMyfansUrl(value: unknown) {
  const raw = cleanText(value);
  return /^https?:\/\/(?:www\.)?(?:myfans\.jp|mfco\.link)\//i.test(raw) ? raw.replace(/[?#].*$/, "") : "";
}

const RESERVED_X_HANDLES = new Set(["home", "explore", "search", "intent", "share", "i", "notifications", "messages", "settings", "login", "signup"]);

export function cleanXProfileUrl(value: unknown) {
  const raw = cleanText(value).replace(/^https:\/\/twitter\.com\//, "https://x.com/");
  const match = raw.match(/^https:\/\/x\.com\/([^/?#]+)\/?$/);
  if (!match) return "";
  const handle = match[1];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) || RESERVED_X_HANDLES.has(handle.toLowerCase())) return "";
  return `https://x.com/${handle}`;
}
