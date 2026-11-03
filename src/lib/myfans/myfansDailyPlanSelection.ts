import { intValue, nullableId, text } from "../formDataValues";

export const MYFANS_DAILY_SELECTED_MAX = 3;

export type MyfansDailyPlanSelectionInput = {
  approvedMediaId: number | null;
  planDate: string;
  postOrder: number;
  optionLabel: string;
};

export function readMyfansDailyPlanSelectionInput(formData: FormData): MyfansDailyPlanSelectionInput {
  const approvedMediaId = nullableId(formData, "approved_media_id");
  const planDate = text(formData, "plan_date");
  const postOrder = intValue(formData, "post_order");
  const optionLabel = text(formData, "option_label").toUpperCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) throw new Error("対象日が不正です。");
  if (!postOrder) throw new Error("投稿枠が不正です。");
  if (!["A", "B", "C"].includes(optionLabel)) throw new Error("候補はA/B/Cから選んでください。");
  return { approvedMediaId, planDate, postOrder, optionLabel };
}

export function requireMyfansDailyPlanSelectionPlan<T>(plan: T | null, error: unknown): T {
  if (error) throw error;
  if (!plan) throw new Error("今日のDaily Planが見つかりません。先に候補を生成してください。");
  return plan;
}

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
