import type { Metadata } from "next";
import { Scale } from "lucide-react";
import Header from "@/components/layout/Header";
import CompareClient from "./CompareClient";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "作品を比較 | 発掘LAB",
  description: "候補に追加したFANZA作品の価格・割引・レビュー・発掘スコア・サンプル動画を横並びで比較できます。",
  canonical: "/compare",
  robots: { index: false, follow: true },
});

export default function ComparePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <div className="flex max-w-4xl items-start gap-4">
              <span className="rounded-2xl bg-pink-50 p-3 text-pink-600"><Scale size={30} /></span>
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-pink-600">COMPARE WORKS</p>
                <h1 className="mt-2 text-3xl font-black sm:text-5xl">作品を買い比べる</h1>
                <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">値段だけでなく、割引、評価、サンプル、作品情報を同じ基準で比較してから選べます。</p>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"><CompareClient /></section>
      </main>
    </>
  );
}
