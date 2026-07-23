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
    <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-bold">
        💿 販売形式
      </h2>

      <div className="space-y-3">
        {prices.map((item) => (
          <div
            key={item.id}
            className="flex justify-between border-b pb-2"
          >
            <span>{item.display_name}</span>

            <span className="font-bold">
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
  );
}