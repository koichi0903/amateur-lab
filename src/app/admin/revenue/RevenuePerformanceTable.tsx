import Link from "next/link";
import { ExternalLink, Gauge } from "lucide-react";

type PerformanceRow = {
  workId: number;
  title: string;
  clicks: number;
  salesCount: number;
  commissionAmount: number;
  conversionRate: number | null;
  earningsPerClick: number | null;
};

export default function RevenuePerformanceTable({
  rows,
  clickError,
}: {
  rows: PerformanceRow[];
  clickError: string | null;
}) {
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

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="pb-3 pr-4">作品</th>
              <th className="pb-3 pr-4 text-right">クリック</th>
              <th className="pb-3 pr-4 text-right">販売</th>
              <th className="pb-3 pr-4 text-right">参考CV率</th>
              <th className="pb-3 pr-4 text-right">報酬</th>
              <th className="pb-3 text-right">報酬/クリック</th>
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
                <td className="py-3 pr-4 text-right text-amber-300">
                  {row.conversionRate === null ? "—" : `${row.conversionRate}%`}
                </td>
                <td className="py-3 pr-4 text-right font-black text-emerald-300">
                  ¥{row.commissionAmount.toLocaleString("ja-JP")}
                </td>
                <td className="py-3 text-right text-cyan-300">
                  {row.earningsPerClick === null ? "—" : `¥${row.earningsPerClick.toLocaleString("ja-JP")}`}
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
