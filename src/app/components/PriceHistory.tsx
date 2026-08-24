import PriceChartTabs from "./PriceChartTabs";
import PriceTimeline from "./PriceTimeline";
import type { PriceHistoryItem } from "@/types/price";

type Props = {
  history: PriceHistoryItem[] | null;
};

export default function PriceHistory({
  history,
}: Props) {
  if (!history || history.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">

        <h2 className="text-2xl font-black">
          💴 価格履歴
        </h2>

        <p className="mt-4 text-zinc-500">
          価格履歴はまだありません。
        </p>

      </section>
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

  const discount =
    history[0].sale_price &&
    history[0].normal_price
      ? Math.round(
          ((history[0].normal_price -
            history[0].sale_price) /
            history[0].normal_price) *
            100
        )
      : 0;

  const normalizePriceType = (name: string) =>
    name.normalize("NFKC").replace(/\s+/g, "");

  const uniquePriceTypes = history.filter(
    (item, index, items) =>
      items.findIndex(
        (candidate) =>
          normalizePriceType(candidate.display_name) ===
          normalizePriceType(item.display_name) &&
          (candidate.period ?? null) === (item.period ?? null)
      ) === index
  );

  return (
    <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">

      <h2 className="text-2xl font-black">
        💴 価格履歴
      </h2>

      <div className="mt-6 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-5">

  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

    <div>

      <div className="text-sm font-semibold text-zinc-500">
        💰 現在価格
      </div>

      <div className="mt-1 text-4xl font-black text-pink-600">
        ¥{currentPrice.toLocaleString()}
      </div>

      {history[0].sale_price &&
        history[0].normal_price && (
          <>
            <div className="mt-1 text-base text-zinc-400 line-through">
              ¥{history[0].normal_price.toLocaleString()}
            </div>

            <div className="mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
              {discount}%OFF
            </div>
          </>
        )}

    </div>

    <div className="min-w-0 text-left sm:text-right">

      <div className="text-sm text-zinc-500">
        🏆 過去最安値
      </div>

      <div className="mt-1 text-2xl font-black">
        ¥{lowestPrice.toLocaleString()}
      </div>

      {isLowestPrice && (
        <div className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
          現在が最安値
        </div>
      )}

      <div className="mt-5">

  <div className="mb-2 text-xs font-bold text-zinc-500">
    販売形式
  </div>

  <div className="flex min-w-0 flex-wrap justify-start gap-2 sm:justify-end">

    {uniquePriceTypes.map((item) => (

        <div
          key={`${item.display_name}\u0000${item.period ?? ""}`}
          className="max-w-full rounded-full border bg-white px-3 py-1.5 text-sm"
        >
          <span className="break-words text-zinc-600">
            {item.display_name}
            {item.period && (
              <span className="ml-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                {item.period}
              </span>
            )}
            <span className="ml-2 text-xs text-zinc-500">
              {(item.price_kind ?? (item.sale_price != null && item.normal_price != null && item.sale_price < item.normal_price ? "sale" : "regular")) === "sale" ? "期間限定セール" : "通常価格"}
            </span>
          </span>

          <span className="ml-2 font-bold text-pink-600">
            ¥
            {(
              item.sale_price ??
              item.normal_price ??
              0
            ).toLocaleString()}
          </span>

        </div>

      ))}

  </div>

</div>

    </div>

  </div>

</div>

      <div className="mt-6">
        <PriceChartTabs history={history} />
      </div>

      <div className="mt-8">
        <PriceTimeline history={history} />
      </div>

    </section>
  );
}
