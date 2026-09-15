import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { ClickForm, RevenueImportForm } from "../MyfansAdminForms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyfansRevenuePage() {
  const analytics = await getMyfansAnalytics();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/myfans" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white">
          <ArrowLeft size={16} /> myfansへ戻る
        </Link>
        <h1 className="mt-7 text-3xl font-black sm:text-5xl">myfans収益分析</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          クリック、購入、報酬、CVR、EPCをmyfans専用データだけで見ます。
        </p>

        {analytics.error && (
          <section className="mt-8 rounded-xl border border-amber-800 bg-amber-950/30 p-5 text-sm text-amber-200">
            myfans用テーブルが未適用です。
          </section>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">30日クリック</p>
            <p className="mt-2 text-3xl font-black">{analytics.totals.clicks30d}</p>
          </section>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">購入</p>
            <p className="mt-2 text-3xl font-black">{analytics.totals.conversions30d}</p>
          </section>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">報酬</p>
            <p className="mt-2 text-3xl font-black">¥{analytics.totals.reward30d.toLocaleString("ja-JP")}</p>
          </section>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">EPC</p>
            <p className="mt-2 text-3xl font-black">{analytics.totals.epc30d === null ? "-" : `¥${analytics.totals.epc30d.toLocaleString("ja-JP")}`}</p>
          </section>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">30日表示</p>
            <p className="mt-2 text-3xl font-black">{analytics.totals.impressions30d.toLocaleString("ja-JP")}</p>
          </section>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">CTR</p>
            <p className="mt-2 text-3xl font-black">{analytics.totals.ctr30d === null ? "-" : `${(analytics.totals.ctr30d * 100).toFixed(2)}%`}</p>
          </section>
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">CVR</p>
            <p className="mt-2 text-3xl font-black">{analytics.totals.cvr30d === null ? "-" : `${(analytics.totals.cvr30d * 100).toFixed(2)}%`}</p>
          </section>
        </div>

        <RevenueImportForm />
        <ClickForm products={analytics.products} posts={analytics.posts} />

        <section className="mt-8 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-black">最近の成果</h2>
          <table className="mt-5 w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="pb-3 pr-4">日時</th>
                <th className="pb-3 pr-4">商品</th>
                <th className="pb-3 pr-4">種別</th>
                <th className="pb-3 pr-4 text-right">売上</th>
                <th className="pb-3 pr-4 text-right">報酬率</th>
                <th className="pb-3 text-right">報酬</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {analytics.conversions.map((conversion) => (
                <tr key={conversion.id}>
                  <td className="py-4 pr-4 text-zinc-400">{conversion.occurred_at.slice(0, 10)}</td>
                  <td className="py-4 pr-4 font-bold">{conversion.myfans_products?.title ?? "-"}</td>
                  <td className="py-4 pr-4 text-zinc-300">{conversion.conversion_type}</td>
                  <td className="py-4 pr-4 text-right">¥{conversion.sale_amount.toLocaleString("ja-JP")}</td>
                  <td className="py-4 pr-4 text-right">{conversion.reward_rate}%</td>
                  <td className="py-4 text-right font-black text-emerald-300">¥{conversion.reward_amount.toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!analytics.conversions.length && <p className="py-6 text-sm text-zinc-500">成果データはまだありません。</p>}
        </section>
      </div>
    </main>
  );
}
