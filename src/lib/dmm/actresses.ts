import type { DmmItem } from "@/types/dmm";

export function formatDmmActresses(item: DmmItem): string | null {
  const names = item.iteminfo?.actress
    ?.map((actress) => actress.name.trim())
    .filter(Boolean);

  return names?.length ? names.join(" / ") : null;
}
