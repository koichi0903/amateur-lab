export function isOfficialSampleMovieUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return ["dmm.co.jp", "fanza.co.jp"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
