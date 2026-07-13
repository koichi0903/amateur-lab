import { supabase } from "@/lib/supabase";
import { updateWork } from "./updateWork";

export async function updateEndedSaleWorks() {
  const now = new Date().toISOString();

  const allWorks: {
    product_id: string;
    sale_end_at: string | null;
  }[] = [];

  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("works")
      .select(`
  product_id,
  sale_end_at,
  is_on_sale
`)
      .not("sale_end_at", "is", null)
.eq("is_on_sale", true)
.lte("sale_end_at", now)

      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allWorks.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  console.log(
    `終了したセール作品 ${allWorks.length}件`
  );

  for (const work of allWorks) {
    await updateWork(work.product_id);
  }

  console.log("終了セール更新完了");
}