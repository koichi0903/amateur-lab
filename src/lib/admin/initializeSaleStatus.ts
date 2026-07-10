import { supabase } from "@/lib/supabase";

export async function initializeSaleStatus(
  productIds: string[]
) {
  if (productIds.length === 0) {
    return {
      saleItems: 0,
      matchedWorks: [],
    };
  }

  // セール作品を検索
  const { data: works, error } = await supabase
    .from("works")
    .select("id, product_id")
    .in("product_id", productIds);

  if (error) {
    throw error;
  }

  // 一旦すべて false
  const { error: resetError } = await supabase
    .from("works")
    .update({
      is_on_sale: false,
    })
    .eq("is_on_sale", true);

  if (resetError) {
    throw resetError;
  }

  // 一致作品だけ true
  if (works.length > 0) {
    const workIds = works.map((work) => work.id);

    const { error: updateError } = await supabase
      .from("works")
      .update({
        is_on_sale: true,
      })
      .in("id", workIds);

    if (updateError) {
      throw updateError;
    }
  }

  console.log("================================");
  console.log("セール一覧件数 :", productIds.length);
  console.log("DB一致件数     :", works.length);
  console.log("================================");

  return {
    saleItems: productIds.length,
    matchedWorks: works,
  };
}