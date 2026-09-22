import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Scale } from "lucide-react";
import CollectionPageJsonLd from "@/app/components/CollectionPageJsonLd";
import Header from "@/components/layout/Header";
import { pageMetadata, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FANZA作品の比較方法｜価格・レビュー・過去最安値で選ぶ | 発掘LAB",
  description: "FANZA作品を価格、レビュー、過去最安値、サンプルの順に比較し、今買うか待つかを判断する方法を解説します。",
  canonical: "/compare-guide",
});

const comparisonPoints = [
  ["現在価格", "今支払う金額を確認し、通常価格や割引率だけで判断しない"],
  ["過去最安値", "現在価格が取得期間内の最安値か、過去最安値に近いかを見る"],
  ["レビュー", "平均評価だけでなく、レビュー件数も合わせて評価の安定感を確認する"],
  ["サンプル", "購入前に作品の雰囲気や視聴環境を確認できるかを見る"],
] as const;

export default function CompareGuidePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <CollectionPageJsonLd
          title="FANZA作品の比較方法"
          description="価格、レビュー、過去最安値、サンプルを比較して購入判断する方法"
          url={`${SITE_URL}/compare-guide`}
        />
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 sm:py-16">
            <Link href="/" className="text-xs font-bold text-slate-500 hover:text-pink-600">TOP / 作品比較ガイド</Link>
            <div className="mt-6 flex max-w-4xl items-start gap-4">
              <span className="shrink-0 rounded-2xl bg-pink-50 p-3 text-pink-600"><Scale size={30} /></span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-pink-600">COMPARISON GUIDE</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">FANZA作品を比較して選ぶ方法</h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                  作品名や割引率だけで決めず、現在価格、過去最安値、レビュー、サンプルを同じ順番で確認すると、今買うか待つかを判断しやすくなります。
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 lg:py-16">
          <section className="rounded-3xl border border-pink-100 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black">購入前に見る4項目</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {comparisonPoints.map(([label, text]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-5">
                  <p className="flex items-center gap-2 font-black"><CheckCircle2 className="text-emerald-600" size={18} />{label}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-black tracking-widest text-emerald-700">STEP 01</p>
              <h2 className="mt-2 text-lg font-black">価格帯を決める</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">予算を先に決めると、割引率だけで候補が広がりすぎるのを防げます。</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-black tracking-widest text-emerald-700">STEP 02</p>
              <h2 className="mt-2 text-lg font-black">評価の根拠を見る</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">平均評価と件数、サンプルの有無を並べて、数値の根拠を確認します。</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-black tracking-widest text-emerald-700">STEP 03</p>
              <h2 className="mt-2 text-lg font-black">買い時を確認する</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">過去最安値と価格記録を確認し、今買うか、比較して待つかを決めます。</p>
            </article>
          </section>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
            <h2 className="text-2xl font-black">実際に比較する</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">気になる作品を最大4本まで比較に追加すると、価格、レビュー、過去最安、サンプルを横並びで確認できます。</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-black">
              <Link href="/compare" className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-3 text-white hover:bg-pink-700">比較画面を開く <ArrowRight size={16} /></Link>
              <Link href="/reports/price-bands" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-slate-700 hover:border-pink-300 hover:text-pink-600">価格帯別に探す <ArrowRight size={16} /></Link>
              <Link href="/price-insights" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-slate-700 hover:border-pink-300 hover:text-pink-600">買い時を見る <ArrowRight size={16} /></Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
