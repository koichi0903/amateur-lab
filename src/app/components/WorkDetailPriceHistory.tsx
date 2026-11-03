import type { PriceHistoryItem } from "@/types/price";
import { formatDisplayName, getPriceSeriesSummary } from "@/lib/createChartData";
import PriceChartTabs from "./PriceChartTabs";

type PriceSeriesSummary = NonNullable<ReturnType<typeof getPriceSeriesSummary>>;

export function formatPriceHistoryDate(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export default function WorkDetailPriceHistory({
  history,
  selectedSummary,
  selectedSeriesKey,
  onSelectedSeriesChange,
}: {
  history: PriceHistoryItem[];
  selectedSummary: PriceSeriesSummary | null;
  selectedSeriesKey: string;
  onSelectedSeriesChange: (seriesKey: string) => void;
}) {
  if (history.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">価格推移はまだありません。</p>;
  }

  return (
    <>
      {selectedSummary && (
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm" aria-live="polite">
          <div className="mb-3 font-bold text-slate-800">
            選択中：{formatDisplayName(selectedSummary.series.displayName)}
            {selectedSummary.series.period ? `［${selectedSummary.series.period}］` : ""}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-slate-500">この系列の最新記録価格</div>
              <div className="font-bold text-pink-700">
                ¥{selectedSummary.latest.price.toLocaleString("ja-JP")}
                {selectedSummary.latest.isSale && (
                  <span className="ml-1 text-xs font-medium text-red-600">セール記録</span>
                )}
              </div>
              {selectedSummary.latest.item.sale_price != null &&
                selectedSummary.latest.item.normal_price != null && (
                  <div className="text-xs text-slate-500">
                    通常価格 ¥{selectedSummary.latest.item.normal_price.toLocaleString("ja-JP")}
                  </div>
                )}
            </div>
            <div>
              <div className="text-xs text-slate-500">この系列の記録上の最安値</div>
              <div className="font-bold text-slate-800">
                ¥{selectedSummary.lowestPrice.toLocaleString("ja-JP")}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">記録件数・期間</div>
              <div className="font-semibold text-slate-800">{selectedSummary.recordCount}件</div>
              <div className="text-xs text-slate-500">
                {formatPriceHistoryDate(selectedSummary.firstDate)}〜{formatPriceHistoryDate(selectedSummary.lastDate)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            価格変更の取得記録です。毎日の連続記録ではなく、このページに読み込んだ最大100件の範囲で集計しています。
          </p>
        </div>
      )}
      <PriceChartTabs
        history={history}
        selectedSeriesKey={selectedSeriesKey}
        onSelectedSeriesChange={onSelectedSeriesChange}
      />
    </>
  );
}
