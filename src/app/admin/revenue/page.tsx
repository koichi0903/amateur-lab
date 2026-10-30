import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
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
import { getGoogleAcquisitionAnalytics } from "@/lib/googleAcquisitionAnalytics";
import RevenuePerformanceTable from "./RevenuePerformanceTable";
import TrafficImprovementPanel from "./TrafficImprovementPanel";
import FanzaDailyPostFunnel from "./FanzaDailyPostFunnel";
import { getFanzaId990DailyOfficialMetrics } from "@/lib/fanzaId990DailyOfficialMetrics";
import RevenueAcquisitionSection from "./RevenueAcquisitionSection";
import RevenueAnalyticsWarnings from "./RevenueAnalyticsWarnings";
import RevenueOfficialSection from "./RevenueOfficialSection";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { formatDateTime, MetricCard, XPostCategoryRevenuePanel, XTrafficPanel } from "./RevenueXPanels";

export default async function RevenueDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ x_days?: string | string[] }>;
}) {
  const query = await searchParams;
  const xDaysParam = Array.isArray(query.x_days) ? query.x_days[0] : query.x_days;
  const xCategoryDays = xDaysParam === "30" ? 30 : 7;
  const [analytics, salesAnalytics, googleAnalytics, id990Daily] = await Promise.all([
    getAffiliateAnalytics(xCategoryDays),
    getAffiliateSalesAnalytics(),
    getGoogleAcquisitionAnalytics(),
    getFanzaId990DailyOfficialMetrics(30),
  ]);
  const id990ConfirmedDaily = id990Daily.rows.filter((row) => row.report_status === "confirmed");
  const id990Confirmed = {
    dayCount: id990ConfirmedDaily.length,
    clickCount: id990ConfirmedDaily.reduce((sum, row) => sum + row.click_count, 0),
    rewardYen: id990ConfirmedDaily.reduce((sum, row) => sum + row.direct_reward_yen + row.category_reward_yen + row.service_reward_yen, 0),
  };
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
              公式成果・サイト内の実測イベント・推定を含む参考分析を分けて表示します。データのない段階は0ではなく「未接続」として示します。
            </p>
          </div>
          <a
            href="/api/admin/revenue/export"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 text-sm font-black transition hover:border-pink-500"
          >
            <Download size={16} /> 直近90日CSV
          </a>
        </div>

        <RevenueAnalyticsWarnings analytics={analytics} />

        <nav aria-label="分析セクション" className="mt-6 flex flex-wrap gap-2">
          <a href="#official-results" className="rounded-full border border-emerald-900 bg-emerald-950/40 px-4 py-2 text-xs font-black text-emerald-200">① FANZA公式成果</a>
          <a href="#measured-events" className="rounded-full border border-cyan-900 bg-cyan-950/40 px-4 py-2 text-xs font-black text-cyan-200">② サイト内実測</a>
          <a href="#reference-analysis" className="rounded-full border border-violet-900 bg-violet-950/40 px-4 py-2 text-xs font-black text-violet-200">③ 参考分析・推定</a>
        </nav>

        <RevenueOfficialSection salesAnalytics={salesAnalytics} id990Daily={id990Daily} id990Confirmed={id990Confirmed} />

        <RevenueAcquisitionSection
          affiliateAnalytics={analytics}
          googleAnalytics={googleAnalytics}
          id990Daily={id990Daily}
          id990Confirmed={id990Confirmed}
          thirtyDayTotal={thirtyDayTotal}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="FANZA CTAイベント・今日" value={`${analytics.totals.today.toLocaleString("ja-JP")}回`} note="日本時間0:00から。購入者数ではありません" />
          <MetricCard label="FANZA CTAイベント・7日" value={`${analytics.totals.sevenDays.toLocaleString("ja-JP")}回`} note={growthNote} />
          <MetricCard label="FANZA CTAイベント・30日" value={`${thirtyDayTotal.toLocaleString("ja-JP")}回`} note={`${analytics.totals.uniqueWorks.toLocaleString("ja-JP")}作品で発生`} />
          <MetricCard label="スマホ固定CTA配置の構成比" value={`${mobileShare}%`} note={`${mobileClicks.toLocaleString("ja-JP")}回 / 30日。端末別比率ではありません`} />
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Smartphone className="text-cyan-400" size={21} />
            <div>
              <h2 className="font-black">流入元 × CTA配置のイベント数</h2>
              <p className="mt-1 text-xs text-zinc-500">30日間。同一訪問者の重複を含む生ログ集計</p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="pb-3 pr-4">流入元</th>
                  <th className="pb-3 pr-4 text-right">合計</th>
                  <th className="pb-3 pr-4 text-right">詳細サイド配置</th>
                  <th className="pb-3 pr-4 text-right">スマホ固定配置</th>
                  <th className="pb-3 text-right">その他配置</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {analytics.sourcePlacements.map((item) => (
                  <tr key={item.key}>
                    <td className="py-3 pr-4 font-bold text-zinc-200">{item.label}</td>
                    <td className="py-3 pr-4 text-right font-black">{item.total.toLocaleString("ja-JP")}</td>
                    <td className="py-3 pr-4 text-right text-zinc-400">{item.desktop.toLocaleString("ja-JP")}</td>
                    <td className="py-3 pr-4 text-right text-cyan-300">{item.mobile.toLocaleString("ja-JP")}</td>
                    <td className="py-3 text-right font-black text-zinc-400">{Math.max(item.total - item.desktop - item.mobile, 0).toLocaleString("ja-JP")}</td>
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

        <XTrafficPanel xTraffic={analytics.xTraffic} />

        <FanzaDailyPostFunnel />

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-emerald-400" size={22} />
            <div>
              <h2 className="font-black">作品別サイト内イベント</h2>
              <p className="mt-1 text-xs text-zinc-500">直近30日・重複を含む作品ページ表示 → FANZA CTA操作。CTRはイベント数の比で、購入率ではありません。</p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-zinc-800">
                  <th className="pb-3 pr-4">作品</th>
                  <th className="pb-3 pr-4">流入元</th>
                  <th className="pb-3 pr-4 text-right">ページ表示回数</th>
                  <th className="pb-3 pr-4 text-right">CTA操作回数</th>
                  <th className="pb-3 pr-4 text-right">表示比</th>
                  <th className="pb-3 pr-4 text-right">価格</th>
                  <th className="pb-3 pr-4 text-right">割引</th>
                  <th className="pb-3 pr-4 text-right">スコア</th>
                  <th className="pb-3 pr-4 text-right">順位</th>
                  <th className="pb-3 text-right">投稿日時</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {analytics.workFunnels.map((row) => (
                  <tr key={`${row.workId}-${row.sourcePage}`}>
                    <td className="max-w-sm py-3 pr-4">
                      <Link href={`/works/${row.workId}`} className="line-clamp-1 font-bold hover:text-pink-300">{row.title}</Link>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-zinc-300">{AFFILIATE_SOURCE_LABELS[row.sourcePage]}</td>
                    <td className="py-3 pr-4 text-right font-black">{row.pageViews.toLocaleString("ja-JP")}</td>
                    <td className="py-3 pr-4 text-right text-emerald-300">{row.fanzaClicks.toLocaleString("ja-JP")}</td>
                    <td className="py-3 pr-4 text-right font-black text-emerald-300">{row.ctr}%</td>
                    <td className="py-3 pr-4 text-right text-zinc-300">{row.price ? `¥${row.price.toLocaleString("ja-JP")}` : "-"}</td>
                    <td className="py-3 pr-4 text-right text-zinc-300">{row.discountRate ? `${row.discountRate}%` : "-"}</td>
                    <td className="py-3 pr-4 text-right text-zinc-300">{row.discoveryScore ?? "-"}</td>
                    <td className="py-3 pr-4 text-right text-zinc-300">{row.ranking ?? "-"}</td>
                    <td className="whitespace-nowrap py-3 text-right text-xs text-zinc-500">{row.latestPostedAt ? formatDateTime(row.latestPostedAt) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!analytics.workFunnels.length && <p className="py-5 text-sm text-zinc-500">作品詳細ページビューはまだありません。</p>}
          </div>
        </section>

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

        <section id="reference-analysis" className="mt-10 mb-4">
          <div className="mb-4">
            <p className="text-xs font-black tracking-[0.16em] text-violet-300">③ 推定を含む参考分析</p>
            <h2 className="mt-1 text-2xl font-black">傾向・改善候補</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
              投稿キーのない過去クリックの投稿別帰属や、少数イベントからの改善判定を含みます。売上の確定帰属や掲載停止の根拠には使わず、仮説を立てる材料として確認してください。
            </p>
          </div>
        </section>

        <TrafficImprovementPanel
          externalChannelInsights={analytics.externalChannelInsights}
          organicLandingInsights={analytics.organicLandingInsights}
          sourceInsights={analytics.sourceInsights}
          placementInsights={analytics.placementInsights}
          ctaVariantInsights={analytics.ctaVariantInsights}
          ctaExperimentEnabled={analytics.ctaExperimentEnabled}
          ctaVariantPerformance={analytics.ctaVariantPerformance}
          ctaImpressionTrackingEnabled={analytics.ctaImpressionTrackingEnabled}
        />

        {analytics.xPostLogError && (
          <section className="mt-6 rounded-2xl border border-amber-800 bg-amber-950/30 p-5 text-sm leading-6 text-amber-200">
            X投稿ログを読み込めませんでした。投稿カテゴリ別ファネルはログテーブルの適用後に有効になります。
          </section>
        )}

        <XPostCategoryRevenuePanel
          days={analytics.categoryDays}
          rows={analytics.xPostCategoryRevenue}
        />
        <RevenuePerformanceTable
          rows={salesAnalytics.performance}
          clickError={salesAnalytics.performanceClickError}
          period={salesAnalytics.currentMonth}
        />

        <p className="mt-6 text-xs leading-6 text-zinc-600">
          この計測は作品ID・流入元・CTA位置・クリック時刻だけを保存します。IPアドレス、Cookie、ユーザー識別子、参照元URLは保存しません。
        </p>
      </div>
    </main>
  );
}
