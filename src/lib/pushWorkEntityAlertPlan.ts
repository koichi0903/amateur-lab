export type WorkEntityAlertType = "actress" | "maker";

export type WorkEntityAlertPlan = {
  type: WorkEntityAlertType;
  available: string[];
  selected: string[];
};

function splitNames(value: string | null | undefined) {
  return [...new Set((value ?? "").split(/\s*\/\s*|\s*／\s*|\s*,\s*|\s*、\s*/).map((name) => name.trim()).filter(Boolean))];
}

function buildEntityAlertPlan(
  type: WorkEntityAlertType,
  availableNames: string | null | undefined,
  selectedNames: string[] | undefined,
): WorkEntityAlertPlan {
  const available = splitNames(availableNames);
  const selected = [...new Set(selectedNames ?? [])].filter((name) => available.includes(name));
  return { type, available, selected };
}

export function buildWorkEntityAlertPlans(
  work: { actress: string | null; maker: string | null },
  selections: { actressAlerts?: string[]; makerAlerts?: string[] },
): WorkEntityAlertPlan[] {
  return [
    buildEntityAlertPlan("actress", work.actress, selections.actressAlerts),
    buildEntityAlertPlan("maker", work.maker, selections.makerAlerts),
  ];
}
