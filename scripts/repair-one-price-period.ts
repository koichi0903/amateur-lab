import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const productId = process.argv[2]?.trim();
if (!productId) throw new Error("product_id is required");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is missing");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { closeBrowser, createBrowser } = await import("@/lib/playwright/browserManager");
  const { updatePlaywrightItem } = await import("@/lib/playwright/updatePlaywrightItem");

  const { data: work, error: workError } = await supabase
    .from("works")
    .select("product_id,url")
    .eq("product_id", productId)
    .single();
  if (workError || !work) throw workError ?? new Error(`work not found: ${productId}`);

  const browser = await createBrowser();
  try {
    await updatePlaywrightItem(productId, work.url, browser);

    const { data: current, error: currentError } = await supabase
      .from("work_prices")
      .select("product_id,display_name,period,price_kind,type,normal_price,sale_price")
      .eq("product_id", productId);
    if (currentError) throw currentError;

    const { error: deleteError } = await supabase
      .from("price_history")
      .delete()
      .eq("product_id", productId);
    if (deleteError) throw deleteError;

    if (current?.length) {
      const { error: insertError } = await supabase.from("price_history").insert(current);
      if (insertError) throw insertError;
    }

    console.log(JSON.stringify({ productId, prices: current ?? [] }, null, 2));
  } finally {
    await closeBrowser(browser);
  }
}

void main();
