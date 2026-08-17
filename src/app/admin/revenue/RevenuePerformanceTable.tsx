import Link from "next/link";
import { ExternalLink, Gauge } from "lucide-react";
import type {
  AffiliatePerformanceRow,
  RevenueAction,
} from "@/lib/affiliateSalesAnalytics";

const actionLabels: Record<RevenueAction, string> = {
  scale: "露出強化",
  improve: "説明改善",
  observe: "様子見",
  reduce: "掲載縮小",
};

const actionStyles: Record<RevenueAction, string> = {
  scale: "border-emerald-800 bg-emerald-950/50 text-emerald-300",
  improve: "border-amber-800 bg-amber-950/50 text-amber-300",
  observe: "border-zinc-700 bg-zinc-800 text-zinc-300",
  reduce: "border-red-900 bg-red-950/50 text-red-300",
};

export default function RevenuePerformanceTable({
  rows,
  clickError,
}: {
  rows: AffiliatePerformanceRow[];
  clickError: string | null;
}) {
  const actionCounts = (Object.keys(actionLabels) as RevenueAction[]).map(
    (action) => ({
      action,
      count: rows.filter((row) => row.action === action).length,
    }),
  );
  const scaleRows = rows
    .filter((row) => row.action === "scale")
    .sort((a, b) => (b.earningsPerClick ?? 0) - (a.earningsPerClick ?? 0))
    .slice(0, 3);
  const improveRows = rows
    .filter((row) => row.action === "improve" || row.action === "reduce")
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 3);

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Gauge className="mt-0.5 shrink-0 text-amber-400" size={22} />
        <div>
          <h2 className="font-black">作品別 送客・売上パフォーマンス</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            当月の発掘LAB内クリックとFANZA商品別レポートを作品単位で比較します。CV率とクリック単価はCookie・計上日の差を含む参考値です。
          </p>
        </div>
      </div>

      {clickError && (
        <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          クリックデータを取得できないため、売上との比較を表示できませんでした。
        </p>
      )}

      {!clickError && rows.length > 0 && (
        <>
        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {actionCounts.map(({ action, count }) => (
            <div key={action} className={`rounded-xl border px-4 py-3 ${actionStyles[action]}`}>
              <p className="text-xs font-black">{actionLabels[action]}</p>
              <p className="mt-1 text-2xl font-black">{count}<span className="ml-1 text-xs">作品</span></p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-4">
            <p className="text-xs font-black tracking-widest text-emerald-300">伸ばす候補</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">当月に売上があり、参考報酬/クリックが高い順です。</p>
            <div className="mt-3 space-y-2">{scaleRows.length ? scaleRows.map((row) => <Link key={row.workId} href={`/works/${row.workId}`} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950/60 px-3 py-2 text-xs font-bold text-zinc-200 hover:text-emerald-300"><span className="line-clamp-1">{row.title}</span><span className="shrink-0 text-emerald-300">¥{row.earningsPerClick?.toLocaleString("ja-JP")}/click</span></Link>) : <p className="text-xs text-zinc-500">判断できる売上データがまだありません。</p>}</div>
          </div>
          <div className="rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
            <p className="text-xs font-black tracking-widest text-amber-300">改善候補</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">販売につながっていない作品。クリック数に応じて改善または掲載縮小を判定します。</p>
            <div className="mt-3 space-y-2">{improveRows.length ? improveRows.map((row) => <Link key={row.workId} href={`/works/${row.workId}`} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950/60 px-3 py-2 text-xs font-bold text-zinc-200 hover:text-amber-300"><span className="line-clamp-1">{row.title}</span><span className="shrink-0 text-amber-300">{row.clicks} clicks / 0件</span></Link>) : <p className="text-xs text-zinc-500">現時点で明確な改善候補はありません。</p>}</div>
          </div>
        </div>
        </>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="pb-3 pr-4">作品</th>
              <th className="pb-3 pr-4 text-right">クリック</th>
              <th className="pb-3 pr-4 text-right">販売</th>
              <th className="pb-3 pr-4 text-right">販売金額</th>
              <th className="pb-3 pr-4 text-right">参考CV率</th>
              <th className="pb-3 pr-4 text-right">報酬</th>
              <th className="pb-3 pr-4 text-right">報酬/クリック</th>
              <th className="pb-3">自動判定</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {rows.map((row) => (
              <tr key={row.workId}>
                <td className="max-w-md py-3 pr-4">
                  <Link
                    href={`/works/${row.workId}`}
                    className="flex items-center gap-2 font-bold text-zinc-200 hover:text-pink-300"
                  >
                    <span className="line-clamp-1">{row.title}</span>
                    <ExternalLink className="shrink-0" size={13} />
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right text-zinc-300">{row.clicks.toLocaleString("ja-JP")}</td>
                <td className="py-3 pr-4 text-right font-black">{row.salesCount.toLocaleString("ja-JP")}</td>
                <td className="py-3 pr-4 text-right text-zinc-300">¥{row.salesAmount.toLocaleString("ja-JP")}</td>
                <td className="py-3 pr-4 text-right text-amber-300">
                  {row.conversionRate === null ? "—" : `${row.conversionRate}%`}
                </td>
                <td className="py-3 pr-4 text-right font-black text-emerald-300">
                  ¥{row.commissionAmount.toLocaleString("ja-JP")}
                </td>
                <td className="py-3 pr-4 text-right text-cyan-300">
                  {row.earningsPerClick === null ? "—" : `¥${row.earningsPerClick.toLocaleString("ja-JP")}`}
                </td>
                <td className="py-3">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-black ${actionStyles[row.action]}`}>
                    {actionLabels[row.action]}
                  </span>
                  <p className="mt-1 max-w-xs text-[11px] leading-4 text-zinc-500">{row.actionReason}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !clickError && (
          <p className="py-6 text-sm text-zinc-500">
            当月は、発掘LABの作品IDと紐づいた売上データがまだありません。
          </p>
        )}
      </div>
    </section>
  );
}
