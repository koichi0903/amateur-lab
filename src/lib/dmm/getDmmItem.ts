import type { DmmItem } from "@/types/dmm";

export async function getDmmItem(
  productId: string
): Promise<DmmItem | null> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId =
    process.env.DMM_AFFILIATE_ID;

  const url =
    "https://api.dmm.com/affiliate/v3/ItemList" +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    "&site=FANZA" +
    "&service=digital" +
    "&floor=videoa" +
    `&cid=${productId}` +
    "&output=json";

  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error("DMM API取得失敗");
  }

  const json = await res.json();

  return json?.result?.items?.[0] ?? null;
}
