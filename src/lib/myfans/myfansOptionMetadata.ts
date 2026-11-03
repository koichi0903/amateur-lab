const OPTION_LABELS = ["A", "B", "C"] as const;

const OPTION_NAMES = {
  A: "おすすめ",
  B: "別の切り口",
  C: "攻めた案",
} as const;

export function myfansOptionMetadata(optionIndex: number) {
  const optionLabel = OPTION_LABELS[optionIndex];
  return {
    optionLabel,
    optionName: OPTION_NAMES[optionLabel],
    optionRank: optionIndex + 1,
  };
}
