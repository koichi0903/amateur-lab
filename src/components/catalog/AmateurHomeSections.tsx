import Link from "next/link";
import FanzaAmateurTopCard from "@/components/catalog/FanzaAmateurTopCard";
import type { FanzaAmateurHomeCard } from "@/lib/dmm/fanzaAmateurCatalog";

function WorkShelf({
  eyebrow,
  title,
  href,
  cards,
  emptyText,
}: {
  eyebrow: string;
  title: string;
  href: string;
  cards: FanzaAmateurHomeCard[];
  emptyText: string;
}) {
  return (
    <section className="mx-auto mt-12 max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-700">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h2>
        </div>
        <Link href={href} className="shrink-0 text-sm font-black text-pink-700 hover:underline">
          もっと見る →
        </Link>
      </div>
      {cards.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {cards.map((card, index) => <FanzaAmateurTopCard key={`${card.item.content_id}-${index}`} card={card} showChart={eyebrow !== "NEW RELEASES"} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

export default function AmateurHomeSections({
  sections,
}: {
  sections: {
    popular: FanzaAmateurHomeCard[];
    latest: FanzaAmateurHomeCard[];
    campaign: FanzaAmateurHomeCard[];
    totalCount: number;
  };
}) {
  return (
    <>
      <WorkShelf eyebrow="POPULAR RANKING" title="人気順" href="/amateur/search?sort=rank" cards={sections.popular} emptyText="人気作品を取得できませんでした。" />
      <WorkShelf eyebrow="SALE RANKING" title="セールの人気順" href="/amateur/sale" cards={sections.campaign} emptyText="現在、APIで確認できるセール作品はありません。" />
      <WorkShelf eyebrow="NEW RELEASES" title="新着作品" href="/amateur/search" cards={sections.latest} emptyText="素人作品を取得後にここへ表示します。" />
      <section className="mx-auto mt-12 max-w-[1500px] px-4 pb-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-slate-600">素人作品 {sections.totalCount.toLocaleString("ja-JP")}{sections.totalCount >= 50_000 ? "+" : ""} 件を保存しています</p>
        <Link href="/amateur/search" className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-8 text-sm font-black text-white transition hover:bg-pink-600">
          素人作品をすべて検索する
        </Link>
      </section>
    </>
  );
}
