import assert from "node:assert/strict";
import test from "node:test";

import { buildFanzaAmateurAffiliateUrl, getFanzaAmateurAffiliateId } from "./fanzaAmateurAffiliate";
import { HAKKUTSU_SITE_DMM_AFFILIATE_ID, withHakkutsuSiteAffiliateId } from "./siteAffiliateUrl";

test("public FANZA links use the website registration id while API requests retain id 991", () => {
  const built = new URL(buildFanzaAmateurAffiliateUrl("https://video.dmm.co.jp/amateur/content/abc"));
  assert.equal(built.searchParams.get("af_id"), HAKKUTSU_SITE_DMM_AFFILIATE_ID);

  const previous = process.env.DMM_AMATEUR_AFFILIATE_ID;
  process.env.DMM_AMATEUR_AFFILIATE_ID = "koichi1928-991";
  try {
    assert.equal(getFanzaAmateurAffiliateId(), "koichi1928-991");
  } finally {
    if (previous === undefined) delete process.env.DMM_AMATEUR_AFFILIATE_ID;
    else process.env.DMM_AMATEUR_AFFILIATE_ID = previous;
  }
});

test("site destination conversion rewrites supported FANZA affiliate parameters", () => {
  const afId = withHakkutsuSiteAffiliateId("https://al.fanza.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2F&af_id=koichi1928-991");
  const affiliateId = withHakkutsuSiteAffiliateId("https://al.fanza.co.jp/?affiliate_id=koichi1928-991");

  assert.equal(new URL(afId).searchParams.get("af_id"), HAKKUTSU_SITE_DMM_AFFILIATE_ID);
  assert.equal(new URL(affiliateId).searchParams.get("affiliate_id"), HAKKUTSU_SITE_DMM_AFFILIATE_ID);
});

test("site destination conversion leaves unrelated or malformed URLs unchanged", () => {
  const otherHost = "https://example.com/?af_id=koichi1928-991";
  const nonHttps = "http://al.fanza.co.jp/?af_id=koichi1928-991";
  const malformed = "not a url";

  assert.equal(withHakkutsuSiteAffiliateId(otherHost), otherHost);
  assert.equal(withHakkutsuSiteAffiliateId(nonHttps), nonHttps);
  assert.equal(withHakkutsuSiteAffiliateId(malformed), malformed);
});
