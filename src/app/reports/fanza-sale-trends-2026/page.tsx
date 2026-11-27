import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { pageMetadata, SITE_URL } from "@/lib/seo";

const title = 'FANZAセール統計｜平均割引率は約35%、"過去最安値"の寿命は中央値3日';
const description = "発掘LABが記録してきた価格履歴（2026年7月8日〜11月27日、通常作品62,581作品・セール81,738件）から、FANZAセールの傾向を集計しました。";

export const metadata: Metadata = pageMetadata({
  title: `${title} | 発掘LAB`,
  description,
  canonical: "/reports/fanza-sale-trends-2026",
});

const makerHref = (name: string) => `/maker/${encodeURIComponent(name)}`;
const genreHref = (name: string) => `/genre/${encodeURIComponent(name)}`;

export default function FanzaSaleTrends2026Page() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8fafc] text-slate-950">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">
            <Link href="/reports" className="text-xs font-bold text-slate-500 hover:text-pink-600">データレポート / 特集</Link>
            <p className="mt-6 text-xs font-black tracking-widest text-emerald-700">PRICE HISTORY SPECIAL</p>
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 text-sm leading-7 text-slate-600">{description}</p>
          </div>
        </section>

        <article className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 lg:py-14">
          <section aria-labelledby="conclusion">
            <h2 id="conclusion" className="text-2xl font-black">結論</h2>
            <ul className="mt-4 list-disc space-y-3 pl-6 text-base leading-8">
              <li>セールの平均割引率は <strong>34.92%</strong>（最大66.89%）</li>
              <li>最安値をつけた作品の <strong>96.55%</strong> はその後値戻りし、戻るまでの日数は <strong>中央値3日</strong></li>
              <li>過去最安値の更新が最も多かった月は <strong>9月（11,966作品）</strong></li>
            </ul>
          </section>

          <section aria-labelledby="makers" className="mt-12">
            <h2 id="makers" className="text-2xl font-black">メーカー別：割引率が高いメーカー（対象作品100件以上）</h2>
            <ol className="mt-5 space-y-3 text-base leading-8">
              <li>1位 <Link className="font-bold text-pink-700 underline" href={makerHref("アパッチ")}>アパッチ</Link> 50.00%</li>
              <li>2位 <Link className="font-bold text-pink-700 underline" href={makerHref("NPJ")}>NPJ</Link> 46.46%</li>
              <li>3位 <Link className="font-bold text-pink-700 underline" href={makerHref("Hunter")}>Hunter</Link> 46.18%</li>
              <li>4位 <Link className="font-bold text-pink-700 underline" href={makerHref("変態紳士倶楽部")}>変態紳士倶楽部</Link> 46.07%</li>
              <li>5位 <Link className="font-bold text-pink-700 underline" href={makerHref("kira☆kira")}>kira☆kira</Link> 45.68%</li>
              <li>6位 <Link className="font-bold text-pink-700 underline" href={makerHref("ROOKIE")}>ROOKIE</Link> 45.56%</li>
              <li>7位 <Link className="font-bold text-pink-700 underline" href={makerHref("ワンズファクトリー")}>ワンズファクトリー</Link> 45.35%</li>
              <li>8位 <Link className="font-bold text-pink-700 underline" href={makerHref("TAMEIKE")}>TAMEIKE</Link> 45.25%</li>
              <li>9位 <Link className="font-bold text-pink-700 underline" href={makerHref("プレミアム")}>プレミアム</Link> 45.23%</li>
              <li>10位 <Link className="font-bold text-pink-700 underline" href={makerHref("無垢")}>無垢</Link> 45.19%</li>
            </ol>
            <p className="mt-6 text-base leading-8">
              セール件数の多い主要メーカーでは、<Link className="text-pink-700 underline" href={makerHref("マドンナ")}>マドンナ</Link>が平均41.93%と高めで、<Link className="text-pink-700 underline" href={makerHref("ムーディーズ")}>ムーディーズ</Link>37.72%、<Link className="text-pink-700 underline" href={makerHref("エスワン ナンバーワンスタイル")}>エスワン</Link>37.67%、<Link className="text-pink-700 underline" href={makerHref("SODクリエイト")}>SODクリエイト</Link>31.86%と、メーカーごとに割引の姿勢がはっきり分かれます。
            </p>
          </section>

          <section aria-labelledby="genres" className="mt-12">
            <h2 id="genres" className="text-2xl font-black">ジャンル別：最安値が更新されやすい</h2>
            <p className="mt-5 text-base leading-8">
              主要ジャンルでは、期間中に最安値を更新した作品の割合が軒並み4割超えでした（<Link className="text-pink-700 underline" href={genreHref("中出し")}>中出し</Link>44.93%、<Link className="text-pink-700 underline" href={genreHref("人妻・主婦")}>人妻・主婦</Link>43.76%、<Link className="text-pink-700 underline" href={genreHref("フェラ")}>フェラ</Link>43.12%、<Link className="text-pink-700 underline" href={genreHref("巨乳")}>巨乳</Link>42.87%）。「前に見た価格が底値とは限らない」ジャンルが多い、ということです。
            </p>
          </section>

          <section aria-labelledby="price-life" className="mt-12">
            <h2 id="price-life" className="text-2xl font-black">最安値の寿命</h2>
            <p className="mt-5 text-base leading-8">
              最安値セール価格をつけた46,983作品のうち45,364作品（96.55%）は、その後に通常価格が最安値を上回りました。最初の値戻りまでの日数の中央値は3日。<strong>「過去最安値」は、見つけた週を逃すと次がいつ来るか分からない</strong>、というのがデータの示すところです。
            </p>
          </section>

          <section aria-labelledby="monthly" className="mt-12">
            <h2 id="monthly" className="text-2xl font-black">月別の最安値更新数</h2>
            <p className="mt-5 text-base leading-8">
              7月1,448／8月5,348／9月11,966／10月7,136／11月7,189作品。9月の突出が目立ちます。なお12月の大型セールは当ラボの記録期間外のため、この統計には含まれていません。年末セールの結果は集計がまとまり次第、このページで追って報告します。
            </p>
          </section>

          <section aria-labelledby="method" className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 id="method" className="text-xl font-black">集計方法と注意</h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              対象は通常作品のみ。価格は「ダウンロード＋ストリーミング／無期限」の代表系列に固定して集計しており、サイト表示価格（作品ごとに最安プランを表示）とは一致しない場合があります。「最安値」は2026年7月8日以降の当ラボ記録上の最安値で、それ以前を含む生涯最安値ではありません。
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
