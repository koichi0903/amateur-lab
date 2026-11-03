import assert from "node:assert/strict";
import test from "node:test";
import { buildRegistrationVerification, emptyRegistrationVerification, getFinalRegistrationStatus, getPreUpdateRegistrationDecision, isRegistrationComplete } from "./registerWorkVerification.ts";

const completeWork = {
  id: 1,
  title: "作品",
  affiliate_url: "https://example.com/affiliate",
  image_url: "https://example.com/image.jpg",
  price: 500,
  sale_price: null,
  playwright_status: "COMPLETED",
};

test("empty registration verification marks every required value incomplete", () => {
  assert.deepEqual(emptyRegistrationVerification(), {
    work: false,
    affiliateUrl: false,
    imageUrl: false,
    price: false,
    workPrices: false,
    priceHistory: false,
    sampleImages: false,
    fanzaCompletion: false,
    playwrightStatus: null,
  });
});

test("projects a complete registration when expected sample images exist", () => {
  const verification = buildRegistrationVerification({
    work: completeWork,
    workPrices: [{ id: 1 }],
    priceHistory: [{ id: 2 }],
    sampleImages: [{ id: 3 }],
    expectsSampleImages: true,
  });

  assert.deepEqual(verification, {
    work: true,
    affiliateUrl: true,
    imageUrl: true,
    price: true,
    workPrices: true,
    priceHistory: true,
    sampleImages: true,
    fanzaCompletion: true,
    playwrightStatus: "COMPLETED",
  });
  assert.equal(isRegistrationComplete(verification), true);
  assert.equal(getPreUpdateRegistrationDecision(false, verification), "already_registered");
  assert.equal(getPreUpdateRegistrationDecision(true, verification), "continue");
  assert.equal(getFinalRegistrationStatus(verification), "registered");
});

test("sample images are optional only when the source item has none", () => {
  const withoutExpectedImages = buildRegistrationVerification({
    work: completeWork,
    workPrices: [{ id: 1 }],
    priceHistory: [{ id: 2 }],
    sampleImages: [],
    expectsSampleImages: false,
  });
  assert.equal(withoutExpectedImages.sampleImages, true);
  assert.equal(isRegistrationComplete(withoutExpectedImages), true);

  const missingExpectedImages = buildRegistrationVerification({
    work: completeWork,
    workPrices: [{ id: 1 }],
    priceHistory: [{ id: 2 }],
    sampleImages: [],
    expectsSampleImages: true,
  });
  assert.equal(missingExpectedImages.sampleImages, false);
  assert.equal(isRegistrationComplete(missingExpectedImages), false);
  assert.equal(getPreUpdateRegistrationDecision(false, missingExpectedImages), "continue");
  assert.equal(getPreUpdateRegistrationDecision(true, missingExpectedImages), "continue");
  assert.equal(getFinalRegistrationStatus(missingExpectedImages), "partial");
  assert.equal(getPreUpdateRegistrationDecision(false, emptyRegistrationVerification()), "failed");
});

test("preserves sale-price fallback and keeps a pending Playwright status incomplete", () => {
  const salePriceFallback = buildRegistrationVerification({
    work: { ...completeWork, price: null, sale_price: 400 },
    workPrices: [{ id: 1 }],
    priceHistory: [{ id: 2 }],
    sampleImages: [{ id: 3 }],
    expectsSampleImages: true,
  });
  assert.equal(salePriceFallback.price, true);

  const zeroPrice = buildRegistrationVerification({
    work: { ...completeWork, price: 0, sale_price: 400 },
    workPrices: [{ id: 1 }],
    priceHistory: [{ id: 2 }],
    sampleImages: [{ id: 3 }],
    expectsSampleImages: true,
  });
  assert.equal(zeroPrice.price, false);

  const pending = buildRegistrationVerification({
    work: { ...completeWork, playwright_status: "PENDING" },
    workPrices: [{ id: 1 }],
    priceHistory: [{ id: 2 }],
    sampleImages: [{ id: 3 }],
    expectsSampleImages: true,
  });
  assert.equal(pending.fanzaCompletion, false);
});
