import FavoriteButton from "@/components/favorites/FavoriteButton";

type Props = {
  work: {
    id: number;
    affiliate_url: string | null;
    sale_price: number | null;
    price: number | null;
    discount_rate: number | null;
    ranking: number | null;
  };
};

export default function PurchaseCard({
  work,
}: Props) {
  const hasValidRanking =
    typeof work.ranking === "number" &&
    work.ranking > 0 &&
    work.ranking < 9999;

  const currentPrice =
    work.sale_price && work.sale_price > 0
      ? work.sale_price
      : work.price;

  return (
    <aside className="sticky top-6 space-y-5">

      <section className="rounded-3xl border bg-white p-6 shadow-sm">

        <div className="text-sm font-bold text-zinc-500">
          現在価格
        </div>

        <div className="mt-3 text-5xl font-black text-pink-600">
          ¥{currentPrice?.toLocaleString()}
        </div>

        {work.sale_price &&
          work.price &&
          work.sale_price < work.price && (
            <>
              <div className="mt-2 text-lg text-zinc-400 line-through">
                ¥{work.price.toLocaleString()}
              </div>

              <div className="mt-3 inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-600">
                🔥 {work.discount_rate}%OFF
              </div>
            </>
          )}

        <a
          href={work.affiliate_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-8 block w-full rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 py-4 text-center text-base font-bold text-white transition hover:scale-[1.02]"
        >
          FANZAで見る
        </a>

        <FavoriteButton
          workId={work.id}
          addLabel="お気に入りに追加"
          className="mt-4 w-full rounded-xl border py-3 font-semibold hover:bg-zinc-50"
        />

      </section>

      {hasValidRanking && (
      <section className="rounded-3xl border bg-white p-6 shadow-sm">

        <div className="text-sm font-bold text-zinc-500">
          人気ランキング
        </div>

        <div className="mt-4 flex items-end justify-between">

          <span className="text-zinc-500">
            現在順位
          </span>

          <span className="text-4xl font-black text-pink-600">
            #{work.ranking}
          </span>

        </div>

      </section>
      )}

    </aside>
  );
}
