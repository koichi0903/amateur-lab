type PriceItem = {
  id?: number;
  display_name: string | null;
  type?: string | null;
  period?: string | null;
  price_kind?: "regular" | "sale" | null;
  normal_price: number | null;
  sale_price: number | null;
};

type Props = {
  prices: PriceItem[];
};

export default function PriceTypes({ prices }: Props) {
  const sortedPrices = prices
    .map((item) => ({
      ...item,
      effectivePrice: item.sale_price ?? item.normal_price,
    }))
    .filter(
      (item): item is PriceItem & { effectivePrice: number } =>
        typeof item.effectivePrice === "number" && item.effectivePrice > 0,
    )
    .sort((a, b) => a.effectivePrice - b.effectivePrice);

  if (sortedPrices.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-4 py-4 sm:px-6">
        <h2 className="text-xl font-bold">📦 販売形式・価格比較</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          現在取得できている販売形式を、価格が安い順に表示しています。
        </p>
      </div>

      <div className="divide-y">
        {sortedPrices.map((item, index) => (
          <div
            key={item.id ?? `${item.type ?? ""}-${item.display_name ?? index}`}
            className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {item.display_name ?? item.type ?? "販売価格"}
                  {item.period && (
                    <span className="ml-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                      {item.period}
                    </span>
                  )}
                  {(item.price_kind ?? (item.sale_price != null && item.normal_price != null && item.sale_price < item.normal_price ? "sale" : "regular")) === "sale" && (
                    <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-600">
                      期間限定セール
                    </span>
                  )}
                </span>
                {index === 0 && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                    最安
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              {item.sale_price &&
                item.normal_price &&
                item.sale_price < item.normal_price && (
                  <div className="mb-1 text-sm text-zinc-400 line-through">
                    ¥{item.normal_price.toLocaleString("ja-JP")}
                  </div>
                )}
              <div className="text-xl font-bold text-pink-600">
                ¥{item.effectivePrice.toLocaleString("ja-JP")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
