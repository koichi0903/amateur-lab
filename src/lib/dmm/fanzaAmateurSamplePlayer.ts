import { HAKKUTSU_SITE_DMM_AFFILIATE_ID } from "@/lib/dmm/siteAffiliateUrl";

const SAMPLE_URL_KEYS = ["size_476_306", "size_560_360", "size_644_414", "size_720_480"] as const;

export function buildFanzaAmateurSamplePlayerUrl(
  sampleMovieUrls: Record<string, string | undefined> | null | undefined,
  contentId: string,
  affiliateId = HAKKUTSU_SITE_DMM_AFFILIATE_ID,
) {
  const sampleUrl = SAMPLE_URL_KEYS.map((key) => sampleMovieUrls?.[key]).find(Boolean);
  if (!sampleUrl) return null;

  try {
    const url = new URL(sampleUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.dmm.co.jp" || !url.pathname.startsWith("/litevideo/")) return null;
    const cid = url.pathname.match(/(?:^|\/)cid=([^/]+)/)?.[1] ?? contentId;
    const player = new URL(`https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${encodeURIComponent(cid)}/mtype=AhRVShI_/service=litevideo/mode=part/width=260/height=167/`);
    player.pathname += `affi_id=${encodeURIComponent(affiliateId)}/`;
    return player.href;
  } catch {
    return null;
  }
}
