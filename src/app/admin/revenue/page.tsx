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
import { getGoogleAcquisitionAnalytics } from "@/lib/googleAcquisitionAnalytics";
import RevenueImportForm from "./RevenueImportForm";
import RevenuePerformanceTable from "./RevenuePerformanceTable";
import TrafficImprovementPanel from "./TrafficImprovementPanel";
import FanzaDailyPostFunnel from "./FanzaDailyPostFunnel";
import FanzaId990DailyOfficialInput from "./FanzaId990DailyOfficialInput";
import { getFanzaId990DailyOfficialMetrics } from "@/lib/fanzaId990DailyOfficialMetrics";

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

function FunnelStage({
  number,
  title,
  value,
  period,
  definition,
  status,
}: {
  number: number;
  title: string;
  value: string;
  period: string;
  definition: string;
  status: "measured" | "google-measured" | "unavailable" | "account-total";
}) {
  const statusLabel = status === "measured"
    ? "サイト内実測"
    : status === "google-measured"
      ? "Google公式計測"
    : status === "account-total"
      ? "公式・月次合計"
      : "未接続／未計測";
  const statusStyle = status === "measured"
    ? "text-emerald-300"
    : status === "google-measured"
      ? "text-cyan-300"
    : status === "account-total"
      ? "text-sky-300"
      : "text-amber-300";

  return (
    <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-black text-zinc-500">{number}. {title}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className={`mt-1 text-[11px] font-black ${statusStyle}`}>{statusLabel} · {period}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{definition}</p>
    </div>
  );
}

type XTraffic = Awaited<ReturnType<typeof getAffiliateAnalytics>>["xTraffic"];
type XPostCategoryRevenue = Awaited<ReturnType<typeof getAffiliateAnalytics>>["xPostCategoryRevenue"];

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
            X投稿リンクから発掘LABの作品ページへ来た後、FANZA公式CTAが押された回数です。人数や購入数ではなく、同じ人の複数回操作も含むイベント数です。
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

function XPostCategoryRevenuePanel({
  days,
  rows,
}: {
  days: number;
  rows: XPostCategoryRevenue;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-fuchsia-800/80 bg-fuchsia-950/20 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-fuchsia-300">
            X CATEGORY FUNNEL
          </p>
          <h2 className="mt-2 text-xl font-black">X投稿カテゴリ別サイト内イベント</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            X投稿ログとURLの <code className="rounded bg-black/30 px-1.5 py-0.5">x_post</code> キーで投稿別に照合します。PV・CTAは重複を含むイベント数です。キーのない過去クリックは、同じ作品の24時間以内のPVから投稿を推定するため、投稿別の数字は参考値です。販売・報酬は含みません。
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-sm font-black">
          {[7, 30].map((value) => (
            <Link
              key={value}
              href={`/admin/revenue?x_days=${value}`}
              className={`rounded-lg px-4 py-2 transition ${days === value ? "bg-fuchsia-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              {value}日
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="pb-3 pr-4">カテゴリ</th>
              <th className="pb-3 pr-4 text-right">投稿数</th>
              <th className="pb-3 pr-4 text-right">作品ページPV</th>
              <th className="pb-3 pr-4 text-right">FANZA CTA回数</th>
              <th className="pb-3 pr-4 text-right">PV比</th>
              <th className="pb-3 pr-4 text-right">PV/投稿</th>
              <th className="pb-3 pr-4 text-right">クリック/投稿</th>
              <th className="pb-3">上位作品</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {rows.map((row) => (
              <tr key={row.category}>
                <td className="whitespace-nowrap py-4 pr-4 font-black text-zinc-100">{row.label}</td>
                <td className="py-4 pr-4 text-right font-bold text-zinc-300">{row.posts.toLocaleString("ja-JP")}</td>
                <td className="py-4 pr-4 text-right font-black text-fuchsia-200">{row.xPageViews.toLocaleString("ja-JP")}</td>
                <td className="py-4 pr-4 text-right font-black text-emerald-300">{row.xFanzaClicks.toLocaleString("ja-JP")}</td>
                <td className="py-4 pr-4 text-right font-black text-emerald-300">{row.xCtr}%</td>
                <td className="py-4 pr-4 text-right text-zinc-300">{row.pvPerPost.toLocaleString("ja-JP")}</td>
                <td className="py-4 pr-4 text-right text-zinc-300">{row.clicksPerPost.toLocaleString("ja-JP")}</td>
                <td className="min-w-[20rem] py-4">
                  {row.topWorks.length ? (
                    <div className="space-y-2">
                      {row.topWorks.slice(0, 3).map((work) => (
                        <Link
                          key={work.workId}
                          href={`/works/${work.workId}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-zinc-950 px-3 py-2 transition hover:text-fuchsia-200"
                        >
                          <span className="truncate font-bold text-zinc-200">{work.title}</span>
                          <span className="whitespace-nowrap text-xs font-black text-zinc-400">
                            {work.xPageViews}PV / {work.xFanzaClicks}送客 / {work.xCtr}%
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-500">まだ対象作品はありません</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-5 text-sm text-zinc-500">投稿カテゴリ別の計測データはまだありません。</p>}
      </div>
    </section>
  );
}

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
  const id990ConfirmedClicks = id990ConfirmedDaily.reduce((sum, row) => sum + row.click_count, 0);
  const id990ConfirmedReward = id990ConfirmedDaily.reduce((sum, row) => sum + row.direct_reward_yen + row.category_reward_yen + row.service_reward_yen, 0);
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

        {!analytics.externalAttributionEnabled && !analytics.error && (
          <section className="mt-8 rounded-2xl border border-amber-800 bg-amber-950/30 p-5 text-sm leading-6 text-amber-200">
            外部流入計測用SQLが未適用です。<code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">20260820_add_external_attribution_to_affiliate_clicks.sql</code>をSupabaseで実行すると、自然検索からFANZAクリックまでの集計が始まります。
          </section>
        )}

        {!analytics.pageViewTrackingEnabled && !analytics.error && (
          <section className="mt-8 rounded-2xl border border-amber-800 bg-amber-950/30 p-5 text-sm leading-6 text-amber-200">
            作品詳細ページビュー計測SQLが未適用です。<code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">20260829_add_work_page_view_funnel.sql</code>をSupabaseで実行すると、作品別CTRの集計が始まります。
          </section>
        )}

        <nav aria-label="分析セクション" className="mt-6 flex flex-wrap gap-2">
          <a href="#official-results" className="rounded-full border border-emerald-900 bg-emerald-950/40 px-4 py-2 text-xs font-black text-emerald-200">① FANZA公式成果</a>
          <a href="#measured-events" className="rounded-full border border-cyan-900 bg-cyan-950/40 px-4 py-2 text-xs font-black text-cyan-200">② サイト内実測</a>
          <a href="#reference-analysis" className="rounded-full border border-violet-900 bg-violet-950/40 px-4 py-2 text-xs font-black text-violet-200">③ 参考分析・推定</a>
        </nav>

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
              value={`¥${salesAnalytics.totals.commissionAmount.toLocaleString("ja-JP")}`}
              note="確定報酬とは差が出る場合があります"
            />
          </div>

          {salesAnalytics.latestImport && (
            <p className="mt-4 text-xs text-zinc-500">
              最終取込: {formatDateTime(salesAnalytics.latestImport.importedAt)} / {salesAnalytics.latestImport.file}
            </p>
          )}

          {!salesAnalytics.currentMonthHasRows && !salesAnalytics.error && (
            <p className="mt-4 text-xs leading-5 text-amber-300">対象月のID990成果行は未取得です。CSV未取込と販売0件を区別できないため、0件とは判定しません。DMM公式のID990レポートも確認してください。</p>
          )}
          {salesAnalytics.non990Totals.rows > 0 && (
            <p className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-200">ID990以外またはID範囲が不明な明細が {salesAnalytics.non990Totals.rows.toLocaleString("ja-JP")} 行あります。これらは発掘LABの990成果・クリック分析に含めていません。</p>
          )}

          <div className="mt-7 border-t border-emerald-900/70 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-emerald-300">DMM OFFICIAL DAILY · ID 990</p>
                <h3 className="mt-1 text-lg font-black">公式日別クリック・報酬</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-400">対象 {id990Daily.fromDate}〜{id990Daily.untilDate}。DMM公式画面から記録します。商品別CSV・サイト内クリック・ID026とは別集計です。</p>
              </div>
              {!id990Daily.error && <p className="text-xs text-zinc-500">確定値のみ集計 / 記録 {id990ConfirmedDaily.length}日</p>}
            </div>
            {id990Daily.error ? (
              <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200">日別公式テーブルを読み込めません。DB設定を確認してください。</p>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricCard label="ID990 確定クリック（30日）" value={id990ConfirmedDaily.length ? `${id990ConfirmedClicks.toLocaleString("ja-JP")}回` : "未記録"} note={`${id990ConfirmedDaily.length}日分。未記録日は合計に含めません。`} />
                  <MetricCard label="ID990 確定報酬（30日）" value={id990ConfirmedDaily.length ? `¥${id990ConfirmedReward.toLocaleString("ja-JP")}` : "未記録"} note="ダイレクト・カテゴリ・サービス新規の合計" />
                  <MetricCard label="速報・未確定日" value={`${id990Daily.rows.filter((row) => row.report_status === "provisional").length}日`} note="確定値の合計から除外" />
                </div>
                <FanzaId990DailyOfficialInput />
                <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-3">対象日</th><th className="px-3 py-3 text-right">公式クリック</th><th className="px-3 py-3 text-right">成果件数</th><th className="px-3 py-3 text-right">報酬額</th><th className="px-3 py-3">状態</th><th className="px-3 py-3">確認日時</th></tr></thead>
                    <tbody className="divide-y divide-zinc-800">
                      {id990Daily.rows.slice(0, 10).map((row) => {
                        const count = row.direct_reward_count + row.category_reward_count + row.service_reward_count;
                        const reward = row.direct_reward_yen + row.category_reward_yen + row.service_reward_yen;
                        return <tr key={row.report_date}><td className="px-3 py-3 font-bold text-zinc-200">{row.report_date}</td><td className="px-3 py-3 text-right font-black text-cyan-200">{row.click_count.toLocaleString("ja-JP")}</td><td className="px-3 py-3 text-right text-zinc-300">{count.toLocaleString("ja-JP")}</td><td className="px-3 py-3 text-right font-black text-emerald-300">¥{reward.toLocaleString("ja-JP")}</td><td className="px-3 py-3">{row.report_status === "confirmed" ? <span className="text-emerald-300">確定</span> : <span className="text-amber-300">速報</span>}</td><td className="px-3 py-3 text-zinc-500">{formatDateTime(row.observed_at)}</td></tr>;
                      })}
                      {!id990Daily.rows.length && <tr><td colSpan={6} className="px-3 py-5 text-center text-zinc-500">まだ未記録です。未記録は0件として集計していません。</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

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

        <section id="measured-events" className="mt-10">
          <div className="mb-4">
            <p className="text-xs font-black tracking-[0.16em] text-cyan-300">② 発掘LAB内で実測したPV・クリック</p>
            <h2 className="mt-1 text-2xl font-black">集客ファネルの現在地</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
              Search ConsoleとGA4の公式計測を、サイト内イベントと区別して表示します。検索クリックとサイト訪問は計測定義が異なり、同一訪問者で結び付けた転換率ではありません。
            </p>
          </div>
          <section className="mb-4 rounded-2xl border border-cyan-900/70 bg-cyan-950/15 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-cyan-300">GOOGLE ACQUISITION</p>
                <h3 className="mt-1 text-lg font-black">検索表示とサイト訪問</h3>
              </div>
              <p className="text-xs text-zinc-500">
                Search Console: {googleAnalytics.period.startDate}〜{googleAnalytics.period.endDate}（3日前まで） · GA4: {googleAnalytics.analyticsPeriod.startDate}〜{googleAnalytics.analyticsPeriod.endDate}（前日まで・速報値は後日変わる場合があります）
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs font-black text-zinc-400">Search Console · Google検索</p>
                {googleAnalytics.searchConsole.available ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <MetricCard label="表示回数" value={`${googleAnalytics.searchConsole.impressions?.toLocaleString("ja-JP")}回`} note="検索結果に表示された回数" />
                      <MetricCard label="クリック" value={`${googleAnalytics.searchConsole.clicks?.toLocaleString("ja-JP")}回`} note="Google検索からのクリック" />
                      <MetricCard label="CTR" value={`${((googleAnalytics.searchConsole.ctr ?? 0) * 100).toFixed(1)}%`} note="クリック ÷ 表示回数" />
                      <MetricCard label="平均掲載順位" value={(googleAnalytics.searchConsole.averagePosition ?? 0).toFixed(1)} note="表示された検索結果での平均" />
                    </div>
                    <p className="mt-3 text-[11px] text-zinc-500">Search Consoleのクリック数は、サイト内セッション数やユニーク訪問者数ではありません。</p>
                  </>
                ) : (
                  <div className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
                    <p className="font-black text-amber-200">連携設定待ち</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      {googleAnalytics.searchConsole.error ?? "Search Consoleの読み取り権限を確認してください。"}
                    </p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs font-black text-zinc-400">Google Analytics 4 · サイト行動</p>
                {googleAnalytics.analytics.available ? (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <MetricCard label="訪問ユーザー" value={`${googleAnalytics.analytics.activeUsers?.toLocaleString("ja-JP")}人`} note={`GA4のアクティブユーザー · ${googleAnalytics.analyticsPeriod.startDate}〜${googleAnalytics.analyticsPeriod.endDate}`} />
                      <MetricCard label="セッション" value={`${googleAnalytics.analytics.sessions?.toLocaleString("ja-JP")}回`} note={`訪問セッション数 · ${googleAnalytics.analyticsPeriod.startDate}〜${googleAnalytics.analyticsPeriod.endDate}`} />
                      <MetricCard label="全ページ表示" value={`${googleAnalytics.analytics.pageViews?.toLocaleString("ja-JP")}回`} note={`作品以外も含むPV · ${googleAnalytics.analyticsPeriod.startDate}〜${googleAnalytics.analyticsPeriod.endDate}`} />
                    </div>
                    <p className="mt-3 text-[11px] text-zinc-500">訪問ユーザーはGA4の集計値です。Cookie拒否等により実人数と一致しない場合があります。</p>
                  </>
                ) : (
                  <div className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
                    <p className="font-black text-amber-200">連携設定待ち</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      {googleAnalytics.analytics.error ?? "GA4の読み取り権限とデータ収集状態を確認してください。"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FunnelStage number={1} title="Google検索表示" value={googleAnalytics.searchConsole.available ? `${googleAnalytics.searchConsole.impressions?.toLocaleString("ja-JP")}回` : "未接続"} period={`${googleAnalytics.period.startDate}〜${googleAnalytics.period.endDate}`} definition="Search Consoleの表示回数。検索結果に表示された回数で、サイト訪問ではありません。" status={googleAnalytics.searchConsole.available ? "google-measured" : "unavailable"} />
            <FunnelStage number={2} title="サイト訪問ユーザー" value={googleAnalytics.analytics.available ? `${googleAnalytics.analytics.activeUsers?.toLocaleString("ja-JP")}人` : "未接続"} period={`${googleAnalytics.analyticsPeriod.startDate}〜${googleAnalytics.analyticsPeriod.endDate}`} definition="GA4のアクティブユーザー数。検索経由に限らない全流入のユーザーです。前日までの速報値で、後日変わる場合があります。" status={googleAnalytics.analytics.available ? "google-measured" : "unavailable"} />
            <FunnelStage number={3} title="作品ページPV" value={analytics.pageViewTrackingEnabled ? `${analytics.totals.workPageViewsThirtyDays.toLocaleString("ja-JP")}回` : "未計測"} period="直近30日" definition={analytics.pageViewTrackingEnabled ? "記録された作品詳細ページ表示イベント。ユニーク訪問者数ではありません。" : "ページ表示計測が有効ではないため、この期間の数字を出せません。"} status={analytics.pageViewTrackingEnabled ? "measured" : "unavailable"} />
            <FunnelStage number={4} title="FANZA CTA" value={`${thirtyDayTotal.toLocaleString("ja-JP")}回`} period="直近30日" definition="サイト内で記録したFANZAリンク操作。購入・購入者数ではありません。" status="measured" />
            <FunnelStage number={5} title="公式報酬（ID990）" value={id990Daily.error ? "未取得" : id990ConfirmedDaily.length ? `${id990ConfirmedClicks.toLocaleString("ja-JP")}クリック / ¥${id990ConfirmedReward.toLocaleString("ja-JP")}` : "未記録"} period={id990Daily.error ? "日別テーブル未接続" : `${id990Daily.fromDate}〜${id990Daily.untilDate}`} definition="DMM公式日別レポートの確定値。未記録日・速報値は除き、商品別月次CSVとは別集計です。" status={!id990Daily.error && id990ConfirmedDaily.length > 0 ? "account-total" : "unavailable"} />
          </div>
          <p className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs leading-5 text-amber-200">
            期間と帰属範囲が異なる段階を並べた全体像です。現在は厳密な一続きのCVファネルや各段階の転換率として比較できません。
          </p>
        </section>

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
