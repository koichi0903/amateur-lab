export type CatalogRunType = "daily_incremental" | "weekly_full";

export type CatalogRunProgress = {
  fetched_item_count: number;
  rank_fetched_item_count: number;
  rank_next_offset: number;
  rank_snapshot_at: string | null;
  current_range: { fromDate: string; toDate: string } | null;
  completed_range_count: number;
  range_count: number;
};

export type CatalogRunStep = CatalogRunProgress & {
  status: "running" | "completed" | "needs_attention" | "limit_reached" | "failed";
  last_error: string | null;
};

export type CatalogRunStepEffects = {
  message: string | null;
  refreshWorks: boolean;
  wait: boolean;
};

function count(value: number) {
  return value.toLocaleString("ja-JP");
}

export function completedRunMessage(
  runLabel: string,
  runType: CatalogRunType,
  run: CatalogRunProgress,
) {
  const rankSummary = runType === "weekly_full"
    ? `人気順位${count(run.rank_fetched_item_count)}件も${run.rank_snapshot_at ? `（${new Date(run.rank_snapshot_at).toLocaleString("ja-JP")}時点）` : ""}保存しました。`
    : "";

  return `${runLabel}が完了しました。${count(run.fetched_item_count)}件を処理しました。${rankSummary}`;
}

export function runningRunMessage(runLabel: string, run: CatalogRunProgress) {
  if (run.rank_next_offset > 0) {
    return `${runLabel}：人気順の順位を取得中 ${count(run.rank_fetched_item_count)} / 5,000件`;
  }

  const range = run.current_range;
  return `${runLabel}：${count(run.fetched_item_count)}件処理 · 期間 ${range ? `${range.fromDate}〜${range.toDate}` : "次の期間を準備中"} · ${count(run.completed_range_count)} / ${count(run.range_count)}範囲完了`;
}

export function catalogRunStepEffects(
  run: CatalogRunStep | null,
  runLabel: string,
  runType: CatalogRunType,
  step: number,
): CatalogRunStepEffects {
  if (!run) return { message: null, refreshWorks: false, wait: false };
  if (run.status === "completed") {
    return { message: completedRunMessage(runLabel, runType, run), refreshWorks: true, wait: false };
  }
  if (run.status === "needs_attention") {
    return {
      message: run.last_error || "取得範囲を分割できないため、確認が必要です。",
      refreshWorks: false,
      wait: false,
    };
  }
  if (run.status === "running") {
    return {
      message: runningRunMessage(runLabel, run),
      refreshWorks: step % 10 === 0,
      wait: true,
    };
  }
  return { message: null, refreshWorks: false, wait: false };
}
