export const MYFANS_DAILY_SELECTED_MAX = 3;

export function selectDailyPlanOption(
  strategyJson: Record<string, unknown>,
  postOrder: number,
  optionLabel: string,
): Record<string, unknown> {
  const previousSelection = strategyJson.daily_option_selection && typeof strategyJson.daily_option_selection === "object"
    ? strategyJson.daily_option_selection as Record<string, string>
    : {};
  const selectingNewSlot = !previousSelection[String(postOrder)];
  if (selectingNewSlot && Object.keys(previousSelection).length >= MYFANS_DAILY_SELECTED_MAX) {
    throw new Error(`selectedは${MYFANS_DAILY_SELECTED_MAX}件までです。4枠目を選ぶには、既存のselectedを見直してください。`);
  }

  return {
    ...strategyJson,
    daily_option_selection: { ...previousSelection, [String(postOrder)]: optionLabel },
  };
}
