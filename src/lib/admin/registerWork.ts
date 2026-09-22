import type { DmmItem } from "@/types/dmm";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { saveDmmItem } from "./save";
import { updateWork } from "./updateWork";

export type RegistrationStatus = "registered" | "partial" | "failed" | "already_registered";

export type RegistrationVerification = {
  work: boolean;
  affiliateUrl: boolean;
  imageUrl: boolean;
  price: boolean;
  workPrices: boolean;
  priceHistory: boolean;
  sampleImages: boolean;
  fanzaCompletion: boolean;
  playwrightStatus: string | null;
};

export type RegisterWorkResult = {
  success: boolean;
  status: RegistrationStatus;
  retryable: boolean;
  message: string;
  verification: RegistrationVerification | null;
};

const emptyVerification = (): RegistrationVerification => ({
  work: false, affiliateUrl: false, imageUrl: false, price: false,
  workPrices: false, priceHistory: false, sampleImages: false,
  fanzaCompletion: false, playwrightStatus: null,
});

async function verifyRegistration(productId: string, expectsSampleImages: boolean): Promise<RegistrationVerification> {
  const verification = emptyVerification();
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id,title,affiliate_url,image_url,price,sale_price,playwright_status")
    .eq("product_id", productId)
    .maybeSingle();
  if (workError) throw workError;
  if (!work) return verification;

  verification.work = Boolean(work.id && work.title);
  verification.affiliateUrl = Boolean(work.affiliate_url);
  verification.imageUrl = Boolean(work.image_url);
  verification.price = Number(work.price ?? work.sale_price ?? 0) > 0;
  verification.playwrightStatus = work.playwright_status ?? null;

  const [{ data: prices, error: pricesError }, { data: history, error: historyError }, { data: sampleImages, error: sampleImagesError }] = await Promise.all([
    supabase.from("work_prices").select("id").eq("product_id", productId).limit(1),
    supabase.from("price_history").select("id").eq("product_id", productId).limit(1),
    supabase.from("work_sample_images").select("id").eq("product_id", productId).limit(1),
  ]);
  if (pricesError) throw pricesError;
  if (historyError) throw historyError;
  if (sampleImagesError) throw sampleImagesError;

  verification.workPrices = Boolean(prices?.length);
  verification.priceHistory = Boolean(history?.length);
  verification.sampleImages = !expectsSampleImages || Boolean(sampleImages?.length);
  verification.fanzaCompletion = verification.price && verification.workPrices && verification.priceHistory && verification.playwrightStatus !== "PENDING";
  return verification;
}

function isComplete(verification: RegistrationVerification) {
  return verification.work && verification.affiliateUrl && verification.imageUrl && verification.price && verification.workPrices && verification.priceHistory && verification.sampleImages && verification.fanzaCompletion;
}

function result(status: RegistrationStatus, message: string, verification: RegistrationVerification | null): RegisterWorkResult {
  return { success: status === "registered", status, retryable: status === "partial", message, verification };
}

export async function registerWork(item: DmmItem): Promise<RegisterWorkResult> {
  const expectsSampleImages = (item.sampleImageURL?.sample_l?.image ?? []).length > 0;
  let saved = false;
  try {
    saved = await saveDmmItem(item, undefined);
  } catch (error) {
    console.error("DMM work save failed", error instanceof Error ? error.message : "unknown");
    return result("failed", "作品の基本情報を保存できませんでした。", null);
  }

  let verification: RegistrationVerification;
  try {
    verification = await verifyRegistration(item.content_id, expectsSampleImages);
  } catch (error) {
    console.error("registration verification failed", error instanceof Error ? error.message : "unknown");
    return result("partial", "登録状態を確認できませんでした。再試行してください。", null);
  }

  if (!saved && !verification.work) return result("failed", "作品の保存に失敗しました。", verification);
  if (!saved && isComplete(verification)) return result("already_registered", "この作品は登録済みです。", verification);

  try {
    await updateWork(item.content_id, item, undefined, undefined, { captureSampleMovie: true });
  } catch (error) {
    console.error("FANZA completion failed", error instanceof Error ? error.message : "unknown");
    try {
      verification = await verifyRegistration(item.content_id, expectsSampleImages);
    } catch {
      verification = emptyVerification();
    }
    return result("partial", "基本情報は保存されましたが、FANZA補完に失敗しました。再試行してください。", verification);
  }

  try {
    verification = await verifyRegistration(item.content_id, expectsSampleImages);
  } catch (error) {
    console.error("registration verification failed", error instanceof Error ? error.message : "unknown");
    return result("partial", "登録後の確認に失敗しました。再試行してください。", null);
  }
  return isComplete(verification)
    ? result("registered", "作品を登録しました。", verification)
    : result("partial", "基本情報は保存されましたが、必須データが不足しています。再試行してください。", verification);
}
