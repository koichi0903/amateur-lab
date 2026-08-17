import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeJapaneseYen, ShieldCheck, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import DealWorkCard from "@/components/deals/DealWorkCard";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import { dealCategories, type DealCategory } from "@/lib/deals";
import { getDeals } from "@/lib/getDeals";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 900;

export const metadata: Metadata = pageMetadata({
  title: "お得なFANZA作品を探す | 発掘LAB",
  description: "セール終了間近、過去最安、1,000円以下、高評価、サンプル動画ありなど、購入条件からお得なFANZA作品を探せます。",
  canonical: "/deals",
});

const previewCategories: DealCategory[] = ["ending-soon", "lowest-price", "under-1000", "high-rated"];

export default async function DealsPage() {
  const previews = await Promise.all(previewCategories.map(async (category) => ({
    category,
    result: await getDeals(category, 0, 4),
  })));
  const structuredItems = Array.from(
    new Map(
      previews
        .flatMap(({ result }) => result.works)
        .map((work) => [work.id, work] as const),
    ).values(),
  ).map((work) => ({
    name: work.title,
    url: `${SITE_URL}/works/${work.id}`,
    image: work.image_url,
  }));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="お得なFANZA作品を探す"
          description="セール・最安値・評価などの購入条件から作品を探せる一覧です。"
          url={`${SITE_URL}/deals`}
          items={structuredItems}
        />
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP <span className="mx-1">/</span> お得に探す</Link>
            <div className="mt-5 flex max-w-4xl items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-emerald-50 p-3 text-emerald-600"><BadgeJapaneseYen size={30} /></span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-emerald-600">SMART DEAL FINDER</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">条件からお得な作品を探す</h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">安さだけでなく、終了時刻・レビュー・無料サンプルまで比較。いま買う理由が分かる作品だけを探せます。</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {(Object.entries(dealCategories) as [DealCategory, (typeof dealCategories)[DealCategory]][]).map(([key, item]) => {
                const Icon = item.icon;
                return <Link key={key} href={`/deals/${key}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-pink-300 hover:text-pink-600"><Icon size={16} />{item.label}</Link>;
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mb-12 grid gap-3 rounded-2xl border border-emerald-100 bg-white p-5 text-sm font-bold leading-6 text-slate-600 sm:grid-cols-3">
            <p className="flex gap-2"><ShieldCheck className="shrink-0 text-emerald-600" size={20} />代表価格は各販売形式の最安値を使用</p>
            <p className="flex gap-2"><Sparkles className="shrink-0 text-pink-600" size={20} />発掘スコアとレビューを併記</p>
            <p className="flex gap-2"><BadgeJapaneseYen className="shrink-0 text-indigo-600" size={20} />購入前にFANZA公式の最終価格を確認</p>
          </div>

          <div className="space-y-14">
            {previews.map(({ category, result }) => {
              const item = dealCategories[category];
              const Icon = item.icon;
              return (
                <section key={category} aria-labelledby={`deals-${category}`}>
                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div><p className="flex items-center gap-2 text-xs font-black tracking-widest text-pink-600"><Icon size={15} />{item.label.toUpperCase()}</p><h2 id={`deals-${category}`} className="mt-1 text-2xl font-black">{item.title}</h2><p className="mt-2 text-sm text-slate-500">{item.description}</p></div>
                    <Link href={`/deals/${category}`} className="flex shrink-0 items-center gap-1 text-sm font-black text-pink-600">すべて見る <ArrowRight size={16} /></Link>
                  </div>
                  {result.works.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{result.works.map((work) => <DealWorkCard key={work.id} work={work} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">現在、該当する作品はありません</div>}
                </section>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
