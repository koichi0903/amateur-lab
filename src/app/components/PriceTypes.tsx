type PriceItem = {
  id: number;
  display_name: string;
  normal_price: number | null;
  sale_price: number | null;
};

type Props = {
  prices: PriceItem[];
};

export default function PriceTypes({
  prices,
}: Props) {
  return (
  <section className="mt-8 rounded-2xl border bg-white shadow-sm">
    <div className="border-b px-6 py-4">
      <h2 className="text-xl font-bold">
        💿 販売形式
      </h2>
    </div>

    <div className="divide-y">
      {prices.map((item, index) => (
        <div
          key={item.id}
          className="flex items-center justify-between px-6 py-5"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {index === 0
                  ? "🥇"
                  : index === 1
                  ? "🥈"
                  : "🥉"}
              </span>

              <span className="font-semibold">
                {item.display_name}
              </span>
            </div>
          </div>

          <div className="text-right">
            {item.sale_price &&
              item.normal_price &&
              item.sale_price < item.normal_price && (
                <div className="mb-1 text-sm text-zinc-400 line-through">
                  ¥{item.normal_price.toLocaleString()}
                </div>
              )}

            <div className="text-xl font-bold text-pink-600">
              ¥
              {(
                item.sale_price ??
                item.normal_price ??
                0
              ).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);
}