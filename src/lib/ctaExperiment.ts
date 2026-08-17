export const CTA_VARIANTS = ["control", "price-focus"] as const;

export type CtaVariant = (typeof CTA_VARIANTS)[number];

export const CTA_VARIANT_LABELS: Record<CtaVariant, string> = {
  control: "価格・サンプル訴求",
  "price-focus": "最安価格訴求",
};

export function normalizeCtaVariant(value: unknown): CtaVariant {
  return value === "price-focus" ? "price-focus" : "control";
}
