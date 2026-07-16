import type { DmmItem } from "@/types/dmm";

async function fetchPage(
  apiId: string,
  affiliateId: string,
  offset: number
): Promise<DmmItem[]> {
  const url =
    "https://api.dmm.com/affiliate/v3/ItemList" +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    "&site=FANZA" +
    "&service=digital" +
    "&floor=videoa" +
    "&hits=100" +
    `&offset=${offset}` +
    "&sort=date" +
    "&article=reserve" +
    "&output=json";

  const res = await fetch(url);

  const json = await res.json();

  return json.result.items ?? [];
}

export async function fetchReserveItems() {
  const apiId = process.env.DMM_API_ID!;
  const affiliateId =
    process.env.DMM_AFFILIATE_ID!;

  const items: DmmItem[] = [];

  for (
    let offset = 1;
    offset <= 901;
    offset += 100
  ) {
    const page = await fetchPage(
      apiId,
      affiliateId,
      offset
    );

    if (page.length === 0) {
      break;
    }

    items.push(...page);
  }

  console.log(
    `予約作品 ${items.length}件取得`
  );

  return items;
}