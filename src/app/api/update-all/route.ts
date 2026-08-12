import { NextRequest, NextResponse } from "next/server";

import { updateEndedSaleWorks } from "@/lib/admin/updateEndedSaleWorks";
import { updateNewWorks } from "@/lib/admin/updateNewWorks";
import { updateOldWorks } from "@/lib/admin/updateOldWorks";
import { updateRanking } from "@/lib/admin/updateRanking";
import { updateReserveWorks } from "@/lib/admin/updateReserveWorks";
import { updateReviewWorks } from "@/lib/admin/updateReviewWorks";
import { updateSaleWorks } from "@/lib/admin/updateSaleWorks";
import { updateScore } from "@/lib/admin/updateScore";
import { updateSemiNewWorks } from "@/lib/admin/updateSemiNewWorks";
import { updateStage } from "@/lib/update/updateStage";

export const maxDuration = 300;

const UPDATE_STEPS = {
  reserve: { label: "予約作品更新", run: updateReserveWorks },
  new: { label: "新作更新", run: updateNewWorks },
  semiNew: { label: "準新作更新", run: updateSemiNewWorks },
  old: { label: "旧作更新", run: updateOldWorks },
  sale: { label: "セール更新", run: updateSaleWorks },
  endedSale: { label: "終了セール更新", run: updateEndedSaleWorks },
  stage: { label: "Stage同期", run: updateStage },
  review: { label: "レビュー更新", run: updateReviewWorks },
  ranking: { label: "ランキング更新", run: updateRanking },
  score: { label: "スコア更新", run: updateScore },
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
    await update.run();

    return NextResponse.json({
      success: true,
      step,
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
