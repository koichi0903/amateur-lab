import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CircleDollarSign,
  Download,
  ExternalLink,
  MousePointerClick,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import {
  AFFILIATE_PLACEMENT_LABELS,
  getAffiliateAnalytics,
} from "@/lib/affiliateAnalytics";
import { getAffiliateSalesAnalytics } from "@/lib/affiliateSalesAnalytics";
import { AFFILIATE_SOURCE_LABELS } from "@/lib/affiliateTracking";
import { getXPostCandidates } from "@/lib/xPostPlanner";
import { getRecentXPostLogs, getXPostOutcomes } from "@/lib/xPostLogs";
import RevenueImportForm from "./RevenueImportForm";
import RevenuePerformanceTable from "./RevenuePerformanceTable";
import TrafficImprovementPanel from "./TrafficImprovementPanel";
import XPostCandidatePanel from "./XPostCandidatePanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-bold text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </section>
  );
}

type XTraffic = Awaited<ReturnType<typeof getAffiliateAnalytics>>["xTraffic"];

function XTrafficPanel({ xTraffic }: { xTraffic: XTraffic }) {
  return (
    <section className="mt-6 rounded-2xl border border-sky-800/80 bg-sky-950/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-sky-300">
            X TRAFFIC
          </p>
          <h2 className="mt-2 text-xl font-black">X送客管理</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            X投稿リンクの <code className="rounded bg-black/30 px-1.5 py-0.5">?from=x</code> 経由で作品詳細に入り、FANZA公式CTAを押したクリックだけを集計します。
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[30rem]">
          <MetricCard label="今日" value={`${xTraffic.today.toLocaleString("ja-JP")}回`} note="日本時間0:00から" />
          <MetricCard label="直近7日" value={`${xTraffic.sevenDays.toLocaleString("ja-JP")}回`} note="X投稿からの送客" />
          <MetricCard label="直近30日" value={`${xTraffic.thirtyDays.toLocaleString("ja-JP")}回`} note="X投稿からの送客" />
          <MetricCard label="全体比率" value={`${xTraffic.share}%`} note="直近30日の送客内訳" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-black text-zinc-300">X経由のクリック上位作品</h3>
          <div className="mt-3 divide-y divide-zinc-800 rounded-xl bg-zinc-950 px-4">
            {xTraffic.topWorks.length ? xTraffic.topWorks.map((work, index) => (
              <Link
                key={work.workId}
                href={`/works/${work.workId}`}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3 transition hover:text-sky-300"
              >
                <span className="text-center text-xs font-black text-zinc-600">{index + 1}</span>
                <span className="truncate text-sm font-bold text-zinc-200">{work.title}</span>
                <span className="whitespace-nowrap text-sm font-black text-sky-300">{work.clicks.toLocaleString("ja-JP")}回</span>
              </Link>
            )) : <p className="py-5 text-sm text-zinc-500">X経由のクリックはまだありません。</p>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black text-zinc-300">直近のX経由クリック</h3>
          <div className="mt-3 divide-y divide-zinc-800 rounded-xl bg-zinc-950 px-4">
            {xTraffic.recent.length ? xTraffic.recent.map((click) => (
              <Link
                key={click.id}
                href={`/works/${click.work_id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 transition hover:text-sky-300"
              >
                <span className="truncate text-sm font-bold text-zinc-200">{click.title}</span>
                <span className="whitespace-nowrap text-xs font-bold text-zinc-500">{formatDateTime(click.clicked_at)}</span>
              </Link>
            )) : <p className="py-5 text-sm text-zinc-500">X経由のクリックはまだありません。</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function RevenueDashboardPage() {
  const [analytics, salesAnalytics] = await Promise.all([
    getAffiliateAnalytics(),
    getAffiliateSalesAnalytics(),
  ]);
  const [xPostLogs, xPostOutcomes] = await Promise.all([
    getRecentXPostLogs(),
    getXPostOutcomes(),
  ]);
  const xPostCandidates = await getXPostCandidates(
    salesAnalytics.performance,
    xPostLogs.logs,
  );
  const maxDaily = Math.max(...analytics.daily.map((item) => item.count), 1);
  const thirtyDayTotal = analytics.totals.thirtyDays;
  const mobileClicks = analytics.placements.find(
    (item) => item.key === "mobile-sticky",
  )?.count ?? 0;
  const mobileShare = thirtyDayTotal > 0
    ? Math.round((mobileClicks / thirtyDayTotal) * 100)
    : 0;
  const growthNote = analytics.totals.growthRate === null
    ? "比較データがまだありません"
    : `前の7日間比 ${analytics.totals.growthRate >= 0 ? "+" : ""}${analytics.totals.growthRate}%`;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white"
            >
              <ArrowLeft size={16} /> 管理画面へ戻る
            </Link>
            <p className="mt-7 text-xs font-black tracking-[0.18em] text-pink-500">
              AFFILIATE TRAFFIC
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">
              FANZA送客分析
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              発掘LABからFANZA公式へ移動したクリックを集計します。販売件数・報酬額ではありません。
            </p>
          </div>
          <a
            href="/api/admin/revenue/export"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 text-sm font-black transition hover:border-pink-500"
          >
            <Download size={16} /> 直近90日CSV
          </a>
        </div>

        {analytics.error && (
          <section className="mt-8 rounded-2xl border border-red-900 bg-red-950/40 p-5">
            <h2 className="font-black text-red-300">クリックデータを読み込めませんでした</h2>
            <p className="mt-2 break-all text-sm text-red-200/70">{analytics.error}</p>
          </section>
        )}

        {!analytics.sourceAttributionEnabled && !analytics.error && (
          <section className="mt-8 rounded-2xl border border-amber-800 bg-amber-950/30 p-5 text-sm leading-6 text-amber-200">
            流入元追加SQLが未適用のため、既存クリックは「直接・不明」で表示しています。新しいマイグレーションをSupabaseで実行すると流入元別の計測が始まります。
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-emerald-900/80 bg-emerald-950/20 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CircleDollarSign className="mt-0.5 shrink-0 text-emerald-400" size={23} />
            <div>
              <h2 className="text-xl font-black">FANZA実売上</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                FANZAアフィリエイトの商品別レポートを対象月ごとに取り込みます。同じ月のCSVを再取込しても二重計上されません。
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
              label={`${salesAnalytics.currentMonth.replace("-", "年")}月 販売件数`}
              value={`${salesAnalytics.totals.salesCount.toLocaleString("ja-JP")}件`}
              note="商品別レポートのサイト全体実績"
            />
            <MetricCard
              label="販売金額"
              value={`¥${salesAnalytics.totals.salesAmount.toLocaleString("ja-JP")}`}
              note="対象月の取込済み合計"
            />
            <MetricCard
              label="発生報酬"
              value={`¥${salesAnalytics.totals.commissionAmount.toLocaleString("ja-JP")}`}
              note="確定報酬とは差が出る場合があります"
            />
          </div>

          {salesAnalytics.latestImport && (
            <p className="mt-4 text-xs text-zinc-500">
              最終取込: {formatDateTime(salesAnalytics.latestImport.importedAt)} / {salesAnalytics.latestImport.file}
            </p>
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

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="今日の送客" value={`${analytics.totals.today.toLocaleString("ja-JP")}回`} note="日本時間0:00から" />
          <MetricCard label="直近7日" value={`${analytics.totals.sevenDays.toLocaleString("ja-JP")}回`} note={growthNote} />
          <MetricCard label="直近30日" value={`${thirtyDayTotal.toLocaleString("ja-JP")}回`} note={`${analytics.totals.uniqueWorks.toLocaleString("ja-JP")}作品へ送客`} />
          <MetricCard label="スマホCTA比率" value={`${mobileShare}%`} note={`${mobileClicks.toLocaleString("ja-JP")}回 / 直近30日`} />
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Smartphone className="text-cyan-400" size={21} />
            <div>
              <h2 className="font-black">流入元ごとのCTA利用</h2>
              <p className="mt-1 text-xs text-zinc-500">直近30日・特集と買い比べも個別に判定</p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="pb-3 pr-4">流入元</th>
                  <th className="pb-3 pr-4 text-right">合計</th>
                  <th className="pb-3 pr-4 text-right">PC</th>
                  <th className="pb-3 pr-4 text-right">スマホ</th>
                  <th className="pb-3 text-right">スマホ比率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {analytics.sourcePlacements.map((item) => (
                  <tr key={item.key}>
                    <td className="py-3 pr-4 font-bold text-zinc-200">{item.label}</td>
                    <td className="py-3 pr-4 text-right font-black">{item.total.toLocaleString("ja-JP")}</td>
                    <td className="py-3 pr-4 text-right text-zinc-400">{item.desktop.toLocaleString("ja-JP")}</td>
                    <td className="py-3 pr-4 text-right text-cyan-300">{item.mobile.toLocaleString("ja-JP")}</td>
                    <td className="py-3 text-right font-black text-cyan-300">{item.mobileShare}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!analytics.sourcePlacements.length && <p className="py-5 text-sm text-zinc-500">クリックデータはまだありません。</p>}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-pink-500" size={22} />
            <div>
              <h2 className="font-black">日別クリック推移</h2>
              <p className="mt-1 text-xs text-zinc-500">直近14日・日本時間</p>
            </div>
          </div>
          <div className="mt-6 grid h-52 grid-cols-14 items-end gap-1.5 sm:gap-3" aria-label="直近14日の日別送客クリック数">
            {analytics.daily.map((item) => (
              <div key={item.key} className="flex h-full min-w-0 flex-col justify-end text-center">
                <span className="mb-1 text-[10px] font-black text-zinc-400">{item.count}</span>
                <div
                  className="min-h-1 rounded-t-md bg-gradient-to-t from-pink-600 to-fuchsia-400"
                  style={{ height: `${Math.max((item.count / maxDaily) * 100, 2)}%` }}
                  title={`${item.key}: ${item.count}回`}
                />
                <span className="mt-2 truncate text-[9px] text-zinc-600 sm:text-[10px]">
                  {item.key.slice(5).replace("-", "/")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <TrafficImprovementPanel
          sourceInsights={analytics.sourceInsights}
          placementInsights={analytics.placementInsights}
          ctaVariantInsights={analytics.ctaVariantInsights}
          ctaExperimentEnabled={analytics.ctaExperimentEnabled}
          ctaVariantPerformance={analytics.ctaVariantPerformance}
          ctaImpressionTrackingEnabled={analytics.ctaImpressionTrackingEnabled}
        />

        <XTrafficPanel xTraffic={analytics.xTraffic} />

        <XPostCandidatePanel
          candidates={xPostCandidates.candidates}
          error={[xPostCandidates.error, xPostLogs.error, xPostOutcomes.error].filter(Boolean).join(" / ") || null}
          logs={xPostLogs.logs}
          outcomes={xPostOutcomes.outcomes}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-emerald-400" size={21} />
              <h2 className="font-black">流入元別</h2>
            </div>
            <div className="mt-5 space-y-4">
              {analytics.sources.length ? analytics.sources.map((item) => {
                const percent = thirtyDayTotal > 0
                  ? Math.round((item.count / thirtyDayTotal) * 100)
                  : 0;
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-zinc-300">{item.label}</span>
                      <span className="font-black">{item.count}回 <span className="text-zinc-500">({percent}%)</span></span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-pink-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-zinc-500">クリックデータはまだありません。</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Smartphone className="text-cyan-400" size={21} />
              <h2 className="font-black">CTA位置別</h2>
            </div>
            <div className="mt-5 space-y-3">
              {analytics.placements.length ? analytics.placements.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-xl bg-zinc-950 px-4 py-4">
                  <span className="text-sm font-bold text-zinc-300">{AFFILIATE_PLACEMENT_LABELS[item.key] ?? item.key}</span>
                  <span className="text-xl font-black text-cyan-300">{item.count.toLocaleString("ja-JP")}回</span>
                </div>
              )) : <p className="text-sm text-zinc-500">クリックデータはまだありません。</p>}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <MousePointerClick className="text-violet-400" size={21} />
            <div>
              <h2 className="font-black">クリック上位作品</h2>
              <p className="mt-1 text-xs text-zinc-500">直近30日</p>
            </div>
          </div>
          <div className="mt-5 divide-y divide-zinc-800">
            {analytics.topWorks.length ? analytics.topWorks.map((work, index) => (
              <Link
                key={work.workId}
                href={`/works/${work.workId}`}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3 transition hover:text-pink-300"
              >
                <span className="text-center text-sm font-black text-zinc-500">{index + 1}</span>
                <span className="truncate text-sm font-bold">{work.title}</span>
                <span className="flex items-center gap-2 text-sm font-black text-pink-400">{work.clicks}回 <ExternalLink size={14} /></span>
              </Link>
            )) : <p className="py-5 text-sm text-zinc-500">クリックデータはまだありません。</p>}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="font-black">直近のクリック</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="pb-3 pr-4">日時</th>
                  <th className="pb-3 pr-4">作品</th>
                  <th className="pb-3 pr-4">流入元</th>
                  <th className="pb-3">CTA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {analytics.recent.map((click) => (
                  <tr key={click.id}>
                    <td className="whitespace-nowrap py-3 pr-4 text-zinc-400">{formatDateTime(click.clicked_at)}</td>
                    <td className="max-w-md py-3 pr-4">
                      <Link href={`/works/${click.work_id}`} className="line-clamp-1 font-bold hover:text-pink-300">{click.title}</Link>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-zinc-300">{AFFILIATE_SOURCE_LABELS[click.source_page]}</td>
                    <td className="whitespace-nowrap py-3 text-zinc-300">{AFFILIATE_PLACEMENT_LABELS[click.placement] ?? click.placement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!analytics.recent.length && <p className="py-5 text-sm text-zinc-500">クリックデータはまだありません。</p>}
          </div>
        </section>

        <RevenuePerformanceTable
          rows={salesAnalytics.performance}
          clickError={salesAnalytics.performanceClickError}
        />

        <p className="mt-6 text-xs leading-6 text-zinc-600">
          この計測は作品ID・流入元・CTA位置・クリック時刻だけを保存します。IPアドレス、Cookie、ユーザー識別子、参照元URLは保存しません。
        </p>
      </div>
    </main>
  );
}
