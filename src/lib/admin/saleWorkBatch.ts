import type { PlaywrightUpdateResult } from "@/lib/playwright/updatePlaywrightItem";

export type SaleWorkTarget = {
  product_id: string;
  url: string | null;
  price: number | null;
  sale_price: number | null;
  sale_end_at: string | null;
};

export async function processSaleWorkBatch(
  batch: SaleWorkTarget[],
  update: (work: SaleWorkTarget) => Promise<PlaywrightUpdateResult>,
  onUpdated: (productId: string) => void,
  onFailure: (work: SaleWorkTarget, error: unknown) => void,
): Promise<boolean[]> {
  return Promise.all(batch.map(async (work) => {
    if (work.sale_price && work.sale_end_at) return true;

    try {
      const result = await update(work);
      if (result === "updated") onUpdated(work.product_id);
      return true;
    } catch (error) {
      onFailure(work, error);
      return false;
    }
  }));
}
