import Link from "next/link";
import { BlueskySampleConsole } from "./BlueskySampleConsole";

const prices = [
  { format: "HDストリーミング・7日間", price: "480円" },
  { format: "ストリーミング＋ダウンロード・無期限", price: "780円" },
  { format: "HD・無期限", price: "1,080円" },
  { format: "4K・無期限", price: "1,380円" },
];

export default function BlueskyPostPrep() {
  return <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-8">
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm text-cyan-300">← 管理画面</Link>
      <h1 className="mt-4 text-3xl font-black">Bluesky 投稿候補レビュー</h1>
      <p className="mt-2 text-sm text-zinc-400">候補の根拠、素材の確認状況、リンク先に送る理由を確認します。</p>

      <section className="mt-6 rounded-2xl border border-amber-700 bg-amber-950/30 p-5">
        <p className="text-sm font-black text-amber-200">判定：投稿見送り</p>
        <h2 className="mt-2 text-xl font-bold">いつき「scute1583」</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100">前回確認では公式サンプルの冒頭と指定区間にセンシティブな表現があり、12〜14秒を使う案は取り下げました。この画面内で別の区間や画像を目視確認できます。素材を表示・切り出しただけでは、投稿向けの安全性や利用許可が確認済みになりません。</p>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-black">オリジナル価格比較カード案</h2>
          <p className="mt-1 text-xs text-zinc-400">文字と図形だけの案。公式画像・サンプル動画は使用していません。</p>
          <div className="mt-4 rounded-xl border border-violet-400/40 bg-gradient-to-br from-violet-950 to-zinc-950 p-5">
            <p className="text-xs font-bold tracking-wide text-violet-200">ITSUKI · SCUTE1583</p>
            <h3 className="mt-2 text-lg font-black">視聴形式で価格を比較</h3>
            <ul className="mt-4 space-y-2">
              {prices.map(({ format, price }) => <li key={format} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 text-sm"><span>{format}</span><strong className="shrink-0 text-violet-200">{price}</strong></li>)}
            </ul>
            <p className="mt-4 text-xs leading-5 text-zinc-300">FANZA公式価格確認：2026-10-31 17:50 JST<br />発掘LABの価格記録：1点（ストリーミング・480円、2026-10-31 13:47 JST）<br />記録が1点のため、値動き・最安値は判断できません。</p>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-black">リンク先の差別化評価</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
              <li>発掘LABには配信形式別の価格履歴と価格アラートがあります。</li>
              <li>ただし本作品の記録は1点だけで、価格推移の比較材料になりません。</li>
              <li>4形式の現在価格はFANZA公式ページでも確認できます。</li>
            </ul>
            <p className="mt-3 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm font-bold text-amber-100">この作品ページへ誘導する追加の購入判断価値が現状では弱いため、リンク付き投稿は見送ります。</p>
            <a href="https://video.dmm.co.jp/amateur/content/?id=scute1583" target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-cyan-300">FANZA公式ページで条件を確認 ↗</a>
          </section>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-black">次に候補化する条件</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">動画を使う場合は、非露骨な区間を目視で確認してから時刻を記録します。価格カードを使う場合も、投稿先で得られる独自情報が公式ページを上回るか先に確認します。</p>
          </section>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-xl font-black">公式サンプル素材を確認・切り出す</h2>
          <p className="mt-1 text-sm text-zinc-400">候補の品番を変更し、画像を見たり動画の区間を切り出せます。投稿と履歴の変更は行いません。</p>
        </div>
        <BlueskySampleConsole initialContentId="scute1583" />
      </section>

      <p className="mt-5 text-xs leading-5 text-zinc-500">価格は2026-10-31時点の確認済み記録です。公開前の再確認が必要です。素材の保存や切り出しは、投稿許可の判定ではありません。投稿、キュー登録、DB/Supabase書込みはありません。</p>
    </div>
  </main>;
}
