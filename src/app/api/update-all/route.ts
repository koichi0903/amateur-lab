import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const REVIEW_BATCH_SIZE = 250;
const REVIEW_TIME_BUDGET_MS = 240_000;

const UPDATE_STEPS = {
  reserve: {
    label: "予約作品更新",
    load: async () => (await import("@/lib/admin/updateReserveWorks")).updateReserveWorks,
  },
  new: {
    label: "新作更新",
    load: async () => (await import("@/lib/admin/updateNewWorks")).updateNewWorks,
  },
  semiNew: {
    label: "準新作更新",
    load: async () => (await import("@/lib/admin/updateSemiNewWorks")).updateSemiNewWorks,
  },
  old: {
    label: "旧作更新",
    load: async () => (await import("@/lib/admin/updateOldWorks")).updateOldWorks,
  },
  sale: {
    label: "セール更新",
    load: async () => (await import("@/lib/admin/updateSaleWorks")).updateSaleWorks,
  },
  endedSale: {
    label: "終了セール更新",
    load: async () =>
      (await import("@/lib/admin/updateEndedSaleWorks")).updateEndedSaleWorks,
  },
  review: {
    label: "レビュー更新",
    load: async () => (await import("@/lib/admin/updateReviewWorks")).updateReviewWorks,
  },
  ranking: {
    label: "ランキング更新",
    load: async () => (await import("@/lib/admin/updateRanking")).updateRanking,
  },
  score: {
    label: "スコア更新",
    load: async () => (await import("@/lib/admin/updateScore")).updateScore,
  },
} as const;

type UpdateStep = keyof typeof UPDATE_STEPS;

function isUpdateStep(value: string | null): value is UpdateStep {
  return value !== null && value in UPDATE_STEPS;
}

export async function POST(request: NextRequest) {
  const step = request.nextUrl.searchParams.get("step");

  if (!isUpdateStep(step)) {
    return NextResponse.json(
      { success: false, message: "更新工程が指定されていません。" },
      { status: 400 },
    );
  }

  const update = UPDATE_STEPS[step];

  try {
    if (step === "review") {
      const run = await UPDATE_STEPS.review.load();
      const result = await run({
        maxItems: REVIEW_BATCH_SIZE,
        timeBudgetMs: REVIEW_TIME_BUDGET_MS,
      });

      const { success: successCount, ...reviewResult } = result;

      return NextResponse.json({
        success: true,
        step,
        ...reviewResult,
        successCount,
        message: result.completed
          ? `${update.label}が完了しました。`
          : `${update.label}を継続中です (${result.processedCount}/${result.totalCount})。`,
      });
    }

    const run = await update.load();
    await run();

    return NextResponse.json({
      success: true,
      step,
      completed: true,
      message: `${update.label}が完了しました。`,
    });
  } catch (error) {
    console.error(`update-all ${step} error:`, error);

    return NextResponse.json(
      {
        success: false,
        step,
        message: `${update.label}に失敗しました。`,
      },
      { status: 500 },
    );
  }
}
