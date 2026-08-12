type Props = {
  work: {
    affiliate_url: string | null;
    sale_price: number | null;
    price: number | null;
    discount_rate: number | null;
  };
};

export default function MobilePurchaseBar({ work }: Props) {
  const currentPrice =
    work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;

  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-pink-100 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_24px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
      <div className="mx-auto flex min-h-12 max-w-7xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold leading-none text-zinc-500">現在価格</div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-2xl font-black leading-none text-pink-600">
              ¥{currentPrice?.toLocaleString() ?? "-"}
            </span>
            {!!work.discount_rate && work.discount_rate > 0 && (
              <span className="shrink-0 text-[10px] font-black text-red-600">
                {work.discount_rate}%OFF
              </span>
            )}
          </div>
        </div>
        <a
          href={work.affiliate_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex h-12 min-w-36 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
        >
          FANZAで見る
        </a>
      </div>
    </aside>
  );
}
