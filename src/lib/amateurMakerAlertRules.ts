export type AmateurMakerAlertWork = {
  content_id: string;
  title: string;
  raw_item: unknown;
};

export type AmateurMakerAlertRule = {
  endpoint: string;
  maker_name: string;
};

export function amateurMakerNames(rawItem: unknown) {
  if (typeof rawItem !== "object" || rawItem === null || Array.isArray(rawItem)) return [];
  const iteminfo = (rawItem as Record<string, unknown>).iteminfo;
  if (typeof iteminfo !== "object" || iteminfo === null || Array.isArray(iteminfo)) return [];
  const makers = (iteminfo as Record<string, unknown>).maker;
  if (!Array.isArray(makers)) return [];
  return [...new Set(makers.flatMap((maker) => {
    if (typeof maker !== "object" || maker === null || Array.isArray(maker)) return [];
    const name = (maker as Record<string, unknown>).name;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  }))];
}

export function amateurMakerAlertNames(works: AmateurMakerAlertWork[]) {
  return [...new Set(works.flatMap((work) => amateurMakerNames(work.raw_item)))];
}

export function matchesAmateurMakerAlert(alert: AmateurMakerAlertRule, work: AmateurMakerAlertWork) {
  return amateurMakerNames(work.raw_item).includes(alert.maker_name);
}

export function amateurMakerAlertDeliveryKey(endpoint: string, makerName: string, contentId: string) {
  return `${endpoint}\u0000${makerName}\u0000${contentId}`;
}
