import type { DmmItem } from "@/types/dmm";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

import { saveDmmItem } from "./save";
import { updateWork } from "./updateWork";
import {
  buildRegistrationVerification,
  emptyRegistrationVerification,
  getFinalRegistrationStatus,
  getPreUpdateRegistrationDecision,
  type RegistrationVerification,
} from "./registerWorkVerification";

export type { RegistrationVerification } from "./registerWorkVerification";

export type RegistrationStatus = "registered" | "partial" | "failed" | "already_registered";

export type RegisterWorkResult = {
  success: boolean;
  status: RegistrationStatus;
  retryable: boolean;
  message: string;
  verification: RegistrationVerification | null;
};

async function verifyRegistration(productId: string, expectsSampleImages: boolean): Promise<RegistrationVerification> {
  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id,title,affiliate_url,image_url,price,sale_price,playwright_status")
    .eq("product_id", productId)
    .maybeSingle();
  if (workError) throw workError;
  if (!work) return emptyRegistrationVerification();

  const [{ data: prices, error: pricesError }, { data: history, error: historyError }, { data: sampleImages, error: sampleImagesError }] = await Promise.all([
    supabase.from("work_prices").select("id").eq("product_id", productId).limit(1),
    supabase.from("price_history").select("id").eq("product_id", productId).limit(1),
    supabase.from("work_sample_images").select("id").eq("product_id", productId).limit(1),
  ]);
  if (pricesError) throw pricesError;
  if (historyError) throw historyError;
  if (sampleImagesError) throw sampleImagesError;

  return buildRegistrationVerification({ work, workPrices: prices, priceHistory: history, sampleImages, expectsSampleImages });
}

function result(status: RegistrationStatus, message: string, verification: RegistrationVerification | null): RegisterWorkResult {
  return { success: status === "registered", status, retryable: status === "partial", message, verification };
}

async function trySaveRegistrationWork(item: DmmItem) {
  try {
    return { saved: await saveDmmItem(item, undefined) };
  } catch (error) {
    console.error("DMM work save failed", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

async function tryVerifyRegistration(
  productId: string,
  expectsSampleImages: boolean,
  onError: (error: unknown) => RegistrationVerification | null,
) {
  try {
    return await verifyRegistration(productId, expectsSampleImages);
  } catch (error) {
    return onError(error);
  }
}

function resultFromVerification(verification: RegistrationVerification): RegisterWorkResult {
  const status = getFinalRegistrationStatus(verification);
  const message = status === "registered"
    ? "作品を登録しました。"
    : "基本情報は保存されましたが、必須データが不足しています。";
  return result(status, message, verification);
}

export async function registerWork(item: DmmItem): Promise<RegisterWorkResult> {
  const expectsSampleImages = (item.sampleImageURL?.sample_l?.image ?? []).length > 0;
  const saveAttempt = await trySaveRegistrationWork(item);
  if (!saveAttempt) return result("failed", "作品の基本情報を保存できませんでした。", null);

  let verification = await tryVerifyRegistration(item.content_id, expectsSampleImages, (error) => {
    console.error("registration verification failed", error instanceof Error ? error.message : "unknown");
    return null;
  });
  if (!verification) return result("partial", "登録状態を確認できませんでした。再試行してください。", null);

  const preUpdateDecision = getPreUpdateRegistrationDecision(saveAttempt.saved, verification);
  if (preUpdateDecision === "failed") return result("failed", "作品の保存に失敗しました。", verification);
  if (preUpdateDecision === "already_registered") return result("already_registered", "この作品は登録済みです。", verification);

  try {
    await updateWork(item.content_id, item, undefined, undefined, { captureSampleMovie: true });
  } catch (error) {
    console.error("FANZA completion failed", error instanceof Error ? error.message : "unknown");
    verification = await tryVerifyRegistration(item.content_id, expectsSampleImages, () => emptyRegistrationVerification())
      ?? emptyRegistrationVerification();
    return result("partial", "基本情報は保存されましたが、FANZA補完に失敗しました。再試行してください。", verification);
  }

  verification = await tryVerifyRegistration(item.content_id, expectsSampleImages, (error) => {
    console.error("registration verification failed", error instanceof Error ? error.message : "unknown");
    return null;
  });
  if (!verification) return result("partial", "登録後の確認に失敗しました。再試行してください。", null);
  return resultFromVerification(verification);
}
