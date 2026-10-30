/**
 * Current DMM registration map for the Hakkutsu LAB website.
 * API ids 990/991 are registered for API use; hakkutsu-lab.com is approved as 026.
 * Keep API request ids separate from links rendered on the approved site.
 */
export const HAKKUTSU_SITE_DMM_AFFILIATE_ID = "koichi1928-026";

export function withHakkutsuSiteAffiliateId(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "al.fanza.co.jp") return value;

    if (url.searchParams.has("af_id")) {
      url.searchParams.set("af_id", HAKKUTSU_SITE_DMM_AFFILIATE_ID);
    } else if (url.searchParams.has("affiliate_id")) {
      url.searchParams.set("affiliate_id", HAKKUTSU_SITE_DMM_AFFILIATE_ID);
    } else {
      return value;
    }

    return url.toString();
  } catch {
    return value;
  }
}
