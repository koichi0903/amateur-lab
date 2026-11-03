import type { PlaywrightUpdateResult } from "./playwright/updatePlaywrightItem";

type LocalPlaywrightUpdateBody = {
  productId?: string;
  limit?: number;
  excludeProductIds?: string[];
};

export type LocalPlaywrightUpdateOptions = {
  productId: string | undefined;
  limit: number;
  excludeProductIds: string[];
  fetchLimit: number;
};

export type LocalPlaywrightUpdateWork = {
  product_id: string;
  url: string | null;
  list_price: number | null;
};

export type LocalPlaywrightUpdateResult = {
  productId: string;
  success: boolean;
  status: PlaywrightUpdateResult | "failed";
  message?: string;
};

export function buildLocalPlaywrightUpdateOptions(body: LocalPlaywrightUpdateBody): LocalPlaywrightUpdateOptions {
  const productId = body.productId?.trim();
  const requestedLimit = Number.isFinite(body.limit) ? Math.trunc(body.limit ?? 10) : 10;
  const limit = productId ? 1 : Math.min(Math.max(requestedLimit, 1), 100);
  const excludeProductIds = (body.excludeProductIds ?? [])
    .filter((id) => /^[a-zA-Z0-9_-]+$/.test(id))
    .slice(0, 100);
  const fetchLimit = productId ? 1 : Math.min(limit + excludeProductIds.length, 200);
  return { productId, limit, excludeProductIds, fetchLimit };
}

export function selectLocalPlaywrightUpdateWorks(
  candidateWorks: LocalPlaywrightUpdateWork[] | null,
  options: LocalPlaywrightUpdateOptions,
) {
  const excluded = new Set(options.excludeProductIds);
  return (candidateWorks ?? [])
    .filter((work) => !excluded.has(work.product_id))
    .slice(0, options.limit);
}

export function localPlaywrightUpdateStatusMessage(status: PlaywrightUpdateResult | "failed") {
  if (status === "unavailable" || status === "unavailable_deferred") return "FANZA側でページまたは価格を確認できませんでした。";
  if (status === "sample_movie_missing") return "サンプル動画を確認できませんでした。";
  return undefined;
}

export function localPlaywrightUpdateFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Playwright更新に失敗しました。";
}

export function summarizeLocalPlaywrightUpdate(results: LocalPlaywrightUpdateResult[]) {
  const succeeded = results.filter((result) => result.status === "updated").length;
  const unavailable = results.filter((result) =>
    result.status === "unavailable"
    || result.status === "unavailable_deferred"
    || result.status === "sample_movie_missing",
  ).length;
  const failed = results.filter((result) => result.status === "failed").length;
  return {
    success: failed === 0,
    succeeded,
    unavailable,
    failed,
    results,
    message: `ローカルPlaywright更新: 更新${succeeded}件 / 利用不可${unavailable}件 / 失敗${failed}件`,
  };
}
