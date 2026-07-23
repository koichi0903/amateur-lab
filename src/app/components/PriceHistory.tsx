import PriceChartTabs from "./PriceChartTabs";
import type { PriceHistoryItem } from "@/types/price";
import PriceTimeline from "./PriceTimeline";

type Props = {
  history: PriceHistoryItem[] | null;
};

export default function PriceHistory({
  history,
}: Props) {
  if (!history || history.length === 0) {
    return (
      <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-2xl font-bold">
          💴 価格履歴
        </h2>

        <p className="text-gray-500">
          価格履歴はまだありません。
        </p>
      </div>
    );
  }

  const lowestPrice = history.reduce((min, item) => {
  const current =
    item.sale_price ??
    item.normal_price ??
    Number.MAX_SAFE_INTEGER;

  return Math.min(min, current);
}, Number.MAX_SAFE_INTEGER);

const currentPrice =
  history[0]?.sale_price ??
  history[0]?.normal_price ??
  0;

const isLowestPrice =
  currentPrice === lowestPrice;

  return (
    <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-bold">
        💴 価格履歴
      </h2>
      
      {history.length > 0 && (
  <div className="mb-6 rounded-lg bg-orange-50 p-4 border">
    <div className="text-sm text-gray-500">
      現在価格
    </div>

    <div className="text-3xl font-bold text-red-600">
      ¥
      {(
        history[0].sale_price ??
        history[0].normal_price ??
        0
      ).toLocaleString()}
      <div className="mt-4 border-t pt-3">
  <div className="text-sm text-gray-500">
    🏆 過去最安値
  </div>

  <div className="text-xl font-bold">
    ¥{lowestPrice.toLocaleString()}
  </div>

  {isLowestPrice && (
    <div className="mt-1 inline-block rounded bg-green-100 px-2 py-1 text-sm font-semibold text-green-700">
      🎉 現在が過去最安値です
    </div>
  )}
</div>
    </div>

    {history[0].sale_price &&
      history[0].normal_price && (
        <>
          <div className="mt-2 text-gray-500 line-through">
            通常価格 ¥
            {history[0].normal_price.toLocaleString()}
          </div>

          <div className="font-bold text-green-600">
            {Math.round(
              ((history[0].normal_price -
                history[0].sale_price) /
                history[0].normal_price) *
                100
            )}
            %OFF
          </div>
        </>
      )}
  </div>
)}

<PriceChartTabs history={history} />

      <PriceTimeline history={history} />
    </div>
  );
}