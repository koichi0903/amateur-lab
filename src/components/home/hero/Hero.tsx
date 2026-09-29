"use client";

import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { useState } from "react";

export default function Hero() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <section className="border-b border-slate-200 bg-[#f8fafc] px-4 pb-4 pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="px-1 pb-4 sm:px-2">
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">FANZA作品の価格と買い時を比較</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">現在価格、過去最安値、レビュー、セール終了時期を見ながら、今チェックしたい作品を探せます。</p>
        </div>
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="text-amber-500">💡</span>使い方ガイド</div>
          <button type="button" aria-label="使い方ガイドを閉じる" onClick={() => setIsOpen(false)} className="text-xl leading-none text-slate-400 transition hover:text-slate-700">×</button>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-2 lg:gap-10">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-700"><Heart size={19} className="shrink-0 text-pink-600" />気になった作品のハートをタップしてお気に入りに保存できます</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3 text-sm font-bold text-slate-700"><Sparkles size={19} className="shrink-0 text-violet-600" /><span><strong>好み発掘</strong>がお気に入りを分析して、あなたの好みの作品をおすすめします</span></div><Link href="/personal-pick" className="shrink-0 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-violet-700">✦ 好みを発掘する</Link></div>
        </div>
      </div>
      </div>
    </section>
  );
}
