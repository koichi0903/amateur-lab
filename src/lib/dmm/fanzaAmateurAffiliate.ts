import { HAKKUTSU_SITE_DMM_AFFILIATE_ID } from "@/lib/dmm/siteAffiliateUrl";

export function getFanzaAmateurAffiliateId() {
  const configured = process.env.DMM_AMATEUR_AFFILIATE_ID?.trim();
  if (configured?.endsWith("-991")) return configured;

  const defaultId = process.env.DMM_AFFILIATE_ID?.trim();
  const derived = defaultId?.replace(/-\d{3}$/, "-991");
  if (derived?.endsWith("-991")) return derived;

  throw new Error("素人作品用のDMMアフィリエイトID 991を確認できません。");
}

export function buildFanzaAmateurAffiliateUrl(canonicalUrl: string) {
  const target = new URL(canonicalUrl);
  if (target.hostname !== "video.dmm.co.jp" || !target.pathname.startsWith("/amateur/content/")) {
    throw new Error("保存された素人作品URLが想定外です。");
  }

  const affiliate = new URL("https://al.fanza.co.jp/");
  affiliate.searchParams.set("lurl", target.href);
  affiliate.searchParams.set("af_id", HAKKUTSU_SITE_DMM_AFFILIATE_ID);
  return affiliate.href;
}
