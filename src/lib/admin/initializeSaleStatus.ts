import { supabase } from "@/lib/supabase";
import { getSaleItems } from "@/lib/playwright/getSaleItems";

export async function initializeSaleStatus() {
  const { productIds, totalPages } = await getSaleItems();

  const { data: works, error } = await supabase
    .from("works")
    .select("id, product_id")
    .in("product_id", productIds);

  if (error) {
    throw error;
  }

  console.log("================================");
  console.log("セール一覧件数 :", productIds.length);
  console.log("総ページ数     :", totalPages);
  console.log("DB一致件数     :", works.length);
  console.log("================================");

  return {
    totalPages,
    saleItems: productIds.length,
    matchedWorks: works,
  };
}