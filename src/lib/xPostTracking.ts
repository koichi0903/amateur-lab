/** Keep the tracking key in an X destination URL identical to the post log key. */
export function withXPostTracking(url: string | null | undefined, postKey: string | null | undefined) {
  if (!url || !postKey) return url ?? null;
  try {
    const parsed = new URL(url, "https://hakkutsu-lab.com");
    parsed.searchParams.set("from", "x");
    parsed.searchParams.set("x_post", postKey.slice(0, 120));
    return /^https?:\/\//i.test(url)
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function xPostKeyFromText(text: string | null | undefined) {
  if (!text) return null;
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
    try {
      const key = new URL(match[0].replace(/[),.!?]+$/, "")).searchParams.get("x_post");
      if (key) return key.slice(0, 120);
    } catch {
      // Ignore non-URL text and continue looking for a tracked link.
    }
  }
  return null;
}
