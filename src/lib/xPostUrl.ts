export type ParsedXPostUrl = {
  handle: string;
  id: string;
};

const X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);

export function parseXPostUrl(value: string): ParsedXPostUrl | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !X_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || url.port) return null;

    const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{8,25})\/?$/i);
    if (!match) return null;

    return { handle: match[1].toLowerCase(), id: match[2] };
  } catch {
    return null;
  }
}
