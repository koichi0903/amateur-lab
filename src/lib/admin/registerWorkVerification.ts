export type RegistrationVerification = {
  work: boolean;
  affiliateUrl: boolean;
  imageUrl: boolean;
  price: boolean;
  workPrices: boolean;
  priceHistory: boolean;
  sampleImages: boolean;
  fanzaCompletion: boolean;
  playwrightStatus: string | null;
};

type RegistrationWorkRow = {
  id?: unknown;
  title?: unknown;
  affiliate_url?: unknown;
  image_url?: unknown;
  price?: unknown;
  sale_price?: unknown;
  playwright_status?: string | null;
};

export function emptyRegistrationVerification(): RegistrationVerification {
  return {
    work: false,
    affiliateUrl: false,
    imageUrl: false,
    price: false,
    workPrices: false,
    priceHistory: false,
    sampleImages: false,
    fanzaCompletion: false,
    playwrightStatus: null,
  };
}

export function buildRegistrationVerification(input: {
  work: RegistrationWorkRow;
  workPrices: readonly unknown[] | null;
  priceHistory: readonly unknown[] | null;
  sampleImages: readonly unknown[] | null;
  expectsSampleImages: boolean;
}): RegistrationVerification {
  const price = Number(input.work.price ?? input.work.sale_price ?? 0) > 0;
  const workPrices = Boolean(input.workPrices?.length);
  const priceHistory = Boolean(input.priceHistory?.length);
  const playwrightStatus = input.work.playwright_status ?? null;

  return {
    work: Boolean(input.work.id && input.work.title),
    affiliateUrl: Boolean(input.work.affiliate_url),
    imageUrl: Boolean(input.work.image_url),
    price,
    workPrices,
    priceHistory,
    sampleImages: !input.expectsSampleImages || Boolean(input.sampleImages?.length),
    fanzaCompletion: price && workPrices && priceHistory && playwrightStatus !== "PENDING",
    playwrightStatus,
  };
}

export function isRegistrationComplete(verification: RegistrationVerification) {
  return verification.work && verification.affiliateUrl && verification.imageUrl && verification.price && verification.workPrices && verification.priceHistory && verification.sampleImages && verification.fanzaCompletion;
}

export type PreUpdateRegistrationDecision = "continue" | "failed" | "already_registered";

export function getPreUpdateRegistrationDecision(
  saved: boolean,
  verification: RegistrationVerification,
): PreUpdateRegistrationDecision {
  if (!saved && !verification.work) return "failed";
  if (!saved && isRegistrationComplete(verification)) return "already_registered";
  return "continue";
}

export function getFinalRegistrationStatus(verification: RegistrationVerification) {
  return isRegistrationComplete(verification) ? "registered" : "partial";
}
