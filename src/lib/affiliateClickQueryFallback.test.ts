import assert from "node:assert/strict";
import test from "node:test";

import {
  nextAffiliateClickFallback,
  type AffiliateClickColumnAvailability,
} from "./affiliateClickQueryFallback";

const allColumnsEnabled: AffiliateClickColumnAvailability = {
  sourceAttributionEnabled: true,
  ctaExperimentEnabled: true,
  externalAttributionEnabled: true,
};

test("falls back in CTA, source, then external attribution order", () => {
  const error = "missing cta_variant source_page external_channel";
  const availability = { ...allColumnsEnabled };

  assert.equal(nextAffiliateClickFallback(error, availability), "ctaExperimentEnabled");
  availability.ctaExperimentEnabled = false;
  assert.equal(nextAffiliateClickFallback(error, availability), "sourceAttributionEnabled");
  availability.sourceAttributionEnabled = false;
  assert.equal(nextAffiliateClickFallback(error, availability), "externalAttributionEnabled");
});

test("does not retry when the error is absent, unrelated, or only names a disabled field", () => {
  assert.equal(nextAffiliateClickFallback(null, allColumnsEnabled), null);
  assert.equal(nextAffiliateClickFallback("network unavailable", allColumnsEnabled), null);
  assert.equal(
    nextAffiliateClickFallback("missing cta_variant", {
      ...allColumnsEnabled,
      ctaExperimentEnabled: false,
    }),
    null,
  );
});
