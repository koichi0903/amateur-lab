import Link from "next/link";
import { CircleDollarSign } from "lucide-react";
import type { getAffiliateSalesAnalytics } from "@/lib/affiliateSalesAnalytics";
import type { getFanzaId990DailyOfficialMetrics } from "@/lib/fanzaId990DailyOfficialMetrics";
import RevenueImportForm from "./RevenueImportForm";
import FanzaId990DailyOfficialPanel from "./FanzaId990DailyOfficialPanel";
import { formatDateTime, MetricCard } from "./RevenueXPanels";

type Props = {
  salesAnalytics: Awaited<ReturnType<typeof getAffiliateSalesAnalytics>>;
  id990Daily: Awaited<ReturnType<typeof getFanzaId990DailyOfficialMetrics>>;
  id990Confirmed: {
    dayCount: number;
    clickCount: number;
    rewardYen: number;
  };
};

export default function RevenueOfficialSection({ salesAnalytics, id990Daily, id990Confirmed }: Props) {
  return (
    <section id="official-results" className="mt-8 rounded-2xl border border-emerald-900/80 bg-emerald-950/20 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <CircleDollarSign className="mt-0.5 shrink-0 text-emerald-400" size={23} />
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-emerald-300">① FANZA公式の成果</p>
          <h2 className="mt-1 text-xl font-black">販売・報酬（公式CSV）</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            FANZA公式の商品別CSVをアフィリエイトID別に記録します。ここでは発掘LAB用の990だけを表示し、全体CSVや026は混ぜません。作品・投稿への購入帰属はできません。
          </p>
        </div>
      </div>

      {salesAnalytics.error && (
        <div className="mt-5 rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm leading-6 text-amber-200">
          売上テーブルを読み込めません。Supabaseで
          <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">20260817_add_affiliate_sales.sql</code>
          を実行してからCSVを取り込んでください。
        </div>
      )}

      <RevenueImportForm />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={`ID990 ${salesAnalytics.currentMonth.replace("-", "年")}月 販売件数`}
          value={`${salesAnalytics.totals.salesCount.toLocaleString("ja-JP")}件`}
          note="990を選択して取り込んだ公式CSVのみ"
        />
        <MetricCard
          label="販売金額"
          value={`¥${salesAnalytics.totals.salesAmount.toLocaleString("ja-JP")}`}
          note="ID990・対象月の取込済み合計"
        />
        <MetricCard
          label="発生報酬"
          value={salesAnalytics.currentMonthHasRows ? `¥${salesAnalytics.totals.commissionAmount.toLocaleString("ja-JP")}` : "未取得"}
          note="確定報酬とは差が出る場合があります"
        />
      </div>

      {salesAnalytics.latestImport && (
        <p className="mt-4 text-xs text-zinc-500">
          最終取込: {formatDateTime(salesAnalytics.latestImport.importedAt)} / {salesAnalytics.latestImport.file}
        </p>
      )}

      <FanzaId990DailyOfficialPanel report={id990Daily} confirmed={id990Confirmed} />

      {!salesAnalytics.currentMonthHasRows && !salesAnalytics.error && (
        <p className="mt-4 text-xs leading-5 text-amber-300">対象月のID990成果行は未取得です。CSV未取込と販売0件を区別できないため、0件とは判定しません。DMM公式のID990レポートも確認してください。</p>
      )}
      {salesAnalytics.non990Totals.rows > 0 && (
        <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-200">ID990以外またはID範囲が不明な明細が {salesAnalytics.non990Totals.rows.toLocaleString("ja-JP")} 行あります。これらは発掘LABの990成果・クリック分析に含めていません。</p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <h3 className="text-sm font-black text-zinc-300">月別報酬推移</h3>
          <div className="mt-3 space-y-2">
            {[...salesAnalytics.monthly].reverse().slice(0, 6).map((month) => (
              <div key={month.key} className="flex items-center justify-between rounded-xl bg-zinc-950 px-4 py-3 text-sm">
                <span className="font-bold text-zinc-400">{month.key.replace("-", "年")}月</span>
                <span className="font-black text-emerald-300">¥{month.commissionAmount.toLocaleString("ja-JP")}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-black text-zinc-300">今月の報酬上位商品</h3>
          <div className="mt-3 divide-y divide-zinc-800 rounded-xl bg-zinc-950 px-4">
            {salesAnalytics.topProducts.length ? salesAnalytics.topProducts.map((product) => {
              const content = (
                <>
                  <span className="text-center text-xs font-black text-zinc-600">{product.rank}</span>
                  <span className="truncate text-sm font-bold text-zinc-200">{product.title}</span>
                  <span className="whitespace-nowrap text-sm font-black text-emerald-300">¥{product.commission_amount.toLocaleString("ja-JP")}</span>
                </>
              );
              return product.work_id ? (
                <Link
                  key={product.id}
                  href={`/works/${product.work_id}`}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3 transition hover:text-pink-300"
                >
                  {content}
                </Link>
              ) : (
                <div key={product.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3">
                  {content}
                </div>
              );
            }) : <p className="py-5 text-sm text-zinc-500">今月の売上データはまだありません。</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
