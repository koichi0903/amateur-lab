import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  MyfansCreator,
  MyfansDailyFunnelCreator,
  MyfansDailyFunnelInputs,
  MyfansDailyFunnelProduct,
} from "./myfansAnalyticsTypes";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type DailyFunnelProductWithRelation = Omit<MyfansDailyFunnelProduct, "myfans_creators"> & {
  myfans_creators?: Pick<MyfansCreator, "myfans_url"> | Array<Pick<MyfansCreator, "myfans_url">> | null;
};

async function fetchCreatorPages(pageSize: number) {
  const creators: MyfansDailyFunnelCreator[] = [];
  let lastCreatorId: number | null = null;
  while (true) {
    const result = lastCreatorId === null
      ? await supabaseAdmin.from("myfans_creators").select("id,x_url,creator_x_url").eq("is_active", true).order("id", { ascending: true }).limit(pageSize)
      : await supabaseAdmin.from("myfans_creators").select("id,x_url,creator_x_url").eq("is_active", true).order("id", { ascending: true }).gt("id", lastCreatorId).limit(pageSize);
    if (result.error) throw new Error(result.error.message);
    const page: MyfansDailyFunnelCreator[] = (result.data ?? []) as MyfansDailyFunnelCreator[];
    creators.push(...page);
    if (page.length < pageSize) break;
    lastCreatorId = page[page.length - 1]?.id ?? lastCreatorId;
  }
  return creators;
}

async function fetchProductPages(pageSize: number) {
  const products: DailyFunnelProductWithRelation[] = [];
  let lastProductId: number | null = null;
  while (true) {
    const result: { data: unknown; error: { message: string } | null } = lastProductId === null
      ? await supabaseAdmin.from("myfans_products").select("id,creator_id,creator_x_url,status,product_url,approved_media_id,approved_media_name,affiliate_media_id,myfans_creators(myfans_url)").order("id", { ascending: true }).limit(pageSize)
      : await supabaseAdmin.from("myfans_products").select("id,creator_id,creator_x_url,status,product_url,approved_media_id,approved_media_name,affiliate_media_id,myfans_creators(myfans_url)").order("id", { ascending: true }).gt("id", lastProductId).limit(pageSize);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as DailyFunnelProductWithRelation[];
    products.push(...page);
    if (page.length < pageSize) break;
    lastProductId = page[page.length - 1]?.id ?? lastProductId;
  }
  return products;
}

export async function fetchAllMyfansDailyFunnelInputs(): Promise<MyfansDailyFunnelInputs> {
  const creators = await fetchCreatorPages(1000);
  const products = await fetchProductPages(1000);
  return {
    creators,
    products: products.map((product) => ({
      ...product,
      myfans_creators: firstRelation(product.myfans_creators),
    })),
  };
}
