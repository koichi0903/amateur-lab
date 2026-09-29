import AffiliateLink from "./AffiliateLink";
import FavoriteButton from "@/components/favorites/FavoriteButton";
import { parseDatabaseDate } from "@/lib/dateTime";

type Props = {
  work: {
    id: number;
    affiliate_url: string | null;
    sale_price: number | null;
    price: number | null;
    discount_rate: number | null;
    sale_end_at?: string | null;
  };
  displayPrice?: number | null;
  displayDiscountRate?: number | null;
};

export default function MobilePurchaseBar({
  work,
  displayPrice,
  displayDiscountRate,
}: Props) {
  // eslint-disable-next-line react-hooks/purity
  const saleActive = !work.sale_end_at || (parseDatabaseDate(work.sale_end_at)?.getTime() ?? 0) > Date.now();
  const currentPrice =
    displayPrice && displayPrice > 0
      ? displayPrice
      : saleActive && work.sale_price && work.sale_price > 0
        ? work.sale_price
        : work.price;
  const discountRate = saleActive ? (displayDiscountRate ?? work.discount_rate) : 0;
  const affiliateUrl = work.affiliate_url?.trim() || null;

  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-pink-100 bg-white/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_24px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
      <div className="mx-auto flex min-h-12 max-w-[1500px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold leading-none text-zinc-500">
            現在の最安価格
          </div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-2xl font-black leading-none text-pink-600">
              {currentPrice && currentPrice > 0
                ? `¥${currentPrice.toLocaleString("ja-JP")}`
                : "価格確認中"}
            </span>
            {!!discountRate && discountRate > 0 && (
              <span className="shrink-0 text-[10px] font-black text-red-600">
                {discountRate}%OFF
              </span>
            )}
          </div>
        </div>

        <FavoriteButton
          workId={work.id}
          iconOnly
          className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-2xl leading-none text-slate-700"
        />

        {affiliateUrl ? (
          <AffiliateLink
            href={affiliateUrl}
            workId={work.id}
            placement="mobile-sticky"
            experiment
            ariaLabel="FANZA公式で作品を確認する（新しいタブで開きます）"
            className="flex h-12 min-w-40 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 text-center text-xs font-black leading-4 text-white shadow-sm transition active:scale-[0.98]"
          >
            FANZAで見る
          </AffiliateLink>
        ) : (
          <span className="flex h-12 min-w-36 shrink-0 items-center justify-center rounded-xl bg-zinc-200 px-4 text-xs font-bold text-zinc-500">
            販売ページ確認中
          </span>
        )}
      </div>
    </aside>
  );
}
