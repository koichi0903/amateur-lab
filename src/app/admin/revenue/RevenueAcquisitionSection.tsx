import { getAffiliateAnalytics } from "@/lib/affiliateAnalytics";
import { getFanzaId990DailyOfficialMetrics } from "@/lib/fanzaId990DailyOfficialMetrics";
import { getGoogleAcquisitionAnalytics } from "@/lib/googleAcquisitionAnalytics";
import { MetricCard } from "./RevenueXPanels";

type AffiliateAnalytics = Awaited<ReturnType<typeof getAffiliateAnalytics>>;
type GoogleAnalytics = Awaited<ReturnType<typeof getGoogleAcquisitionAnalytics>>;
type OfficialDailyMetrics = Awaited<ReturnType<typeof getFanzaId990DailyOfficialMetrics>>;
type Id990Confirmed = { dayCount: number; clickCount: number; rewardYen: number };
type FunnelStatus = "measured" | "google-measured" | "unavailable" | "account-total";

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
  status: FunnelStatus;
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

function GoogleAcquisitionCards({ analytics }: { analytics: GoogleAnalytics }) {
  return (
    <section className="mb-4 rounded-2xl border border-cyan-900/70 bg-cyan-950/15 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-cyan-300">GOOGLE ACQUISITION</p>
          <h3 className="mt-1 text-lg font-black">検索表示とサイト訪問</h3>
        </div>
        <p className="text-xs text-zinc-500">
          Search Console: {analytics.period.startDate}〜{analytics.period.endDate}（3日前まで） · GA4: {analytics.analyticsPeriod.startDate}〜{analytics.analyticsPeriod.endDate}（前日まで・速報値は後日変わる場合があります）
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs font-black text-zinc-400">Search Console · Google検索</p>
          {analytics.searchConsole.available ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MetricCard label="表示回数" value={`${analytics.searchConsole.impressions?.toLocaleString("ja-JP")}回`} note="検索結果に表示された回数" />
                <MetricCard label="クリック" value={`${analytics.searchConsole.clicks?.toLocaleString("ja-JP")}回`} note="Google検索からのクリック" />
                <MetricCard label="CTR" value={`${((analytics.searchConsole.ctr ?? 0) * 100).toFixed(1)}%`} note="クリック ÷ 表示回数" />
                <MetricCard label="平均掲載順位" value={(analytics.searchConsole.averagePosition ?? 0).toFixed(1)} note="表示された検索結果での平均" />
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">Search Consoleのクリック数は、サイト内セッション数やユニーク訪問者数ではありません。</p>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
              <p className="font-black text-amber-200">連携設定待ち</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {analytics.searchConsole.error ?? "Search Consoleの読み取り権限を確認してください。"}
              </p>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs font-black text-zinc-400">Google Analytics 4 · サイト行動</p>
          {analytics.analytics.available ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MetricCard label="訪問ユーザー" value={`${analytics.analytics.activeUsers?.toLocaleString("ja-JP")}人`} note={`GA4のアクティブユーザー · ${analytics.analyticsPeriod.startDate}〜${analytics.analyticsPeriod.endDate}`} />
                <MetricCard label="セッション" value={`${analytics.analytics.sessions?.toLocaleString("ja-JP")}回`} note={`訪問セッション数 · ${analytics.analyticsPeriod.startDate}〜${analytics.analyticsPeriod.endDate}`} />
                <MetricCard label="全ページ表示" value={`${analytics.analytics.pageViews?.toLocaleString("ja-JP")}回`} note={`作品以外も含むPV · ${analytics.analyticsPeriod.startDate}〜${analytics.analyticsPeriod.endDate}`} />
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">訪問ユーザーはGA4の集計値です。Cookie拒否等により実人数と一致しない場合があります。</p>
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
              <p className="font-black text-amber-200">連携設定待ち</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {analytics.analytics.error ?? "GA4の読み取り権限とデータ収集状態を確認してください。"}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RevenueFunnelStages({
  affiliateAnalytics,
  googleAnalytics,
  id990Daily,
  id990Confirmed,
  thirtyDayTotal,
}: {
  affiliateAnalytics: AffiliateAnalytics;
  googleAnalytics: GoogleAnalytics;
  id990Daily: OfficialDailyMetrics;
  id990Confirmed: Id990Confirmed;
  thirtyDayTotal: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <FunnelStage
        number={1}
        title="Google検索表示"
        value={googleAnalytics.searchConsole.available ? `${googleAnalytics.searchConsole.impressions?.toLocaleString("ja-JP")}回` : "未接続"}
        period={`${googleAnalytics.period.startDate}〜${googleAnalytics.period.endDate}`}
        definition="Search Consoleの表示回数。検索結果に表示された回数で、サイト訪問ではありません。"
        status={googleAnalytics.searchConsole.available ? "google-measured" : "unavailable"}
      />
      <FunnelStage
        number={2}
        title="サイト訪問ユーザー"
        value={googleAnalytics.analytics.available ? `${googleAnalytics.analytics.activeUsers?.toLocaleString("ja-JP")}人` : "未接続"}
        period={`${googleAnalytics.analyticsPeriod.startDate}〜${googleAnalytics.analyticsPeriod.endDate}`}
        definition="GA4のアクティブユーザー数。検索経由に限らない全流入のユーザーです。前日までの速報値で、後日変わる場合があります。"
        status={googleAnalytics.analytics.available ? "google-measured" : "unavailable"}
      />
      <FunnelStage
        number={3}
        title="作品ページPV"
        value={affiliateAnalytics.pageViewTrackingEnabled ? `${affiliateAnalytics.totals.workPageViewsThirtyDays.toLocaleString("ja-JP")}回` : "未計測"}
        period="直近30日"
        definition={affiliateAnalytics.pageViewTrackingEnabled ? "記録された作品詳細ページ表示イベント。ユニーク訪問者数ではありません。" : "ページ表示計測が有効ではないため、この期間の数字を出せません。"}
        status={affiliateAnalytics.pageViewTrackingEnabled ? "measured" : "unavailable"}
      />
      <FunnelStage
        number={4}
        title="FANZA CTA"
        value={`${thirtyDayTotal.toLocaleString("ja-JP")}回`}
        period="直近30日"
        definition="サイト内で記録したFANZAリンク操作。購入・購入者数ではありません。"
        status="measured"
      />
      <FunnelStage
        number={5}
        title="公式報酬（ID990）"
        value={id990Daily.error ? "未取得" : id990Confirmed.dayCount ? `${id990Confirmed.clickCount.toLocaleString("ja-JP")}クリック / ¥${id990Confirmed.rewardYen.toLocaleString("ja-JP")}` : "未記録"}
        period={id990Daily.error ? "日別テーブル未接続" : `${id990Daily.fromDate}〜${id990Daily.untilDate}`}
        definition="DMM公式日別レポートの確定値。未記録日・速報値は除き、商品別月次CSVとは別集計です。"
        status={!id990Daily.error && id990Confirmed.dayCount > 0 ? "account-total" : "unavailable"}
      />
    </div>
  );
}

export default function RevenueAcquisitionSection({
  affiliateAnalytics,
  googleAnalytics,
  id990Daily,
  id990Confirmed,
  thirtyDayTotal,
}: {
  affiliateAnalytics: AffiliateAnalytics;
  googleAnalytics: GoogleAnalytics;
  id990Daily: OfficialDailyMetrics;
  id990Confirmed: Id990Confirmed;
  thirtyDayTotal: number;
}) {
  return (
    <section id="measured-events" className="mt-10">
      <div className="mb-4">
        <p className="text-xs font-black tracking-[0.16em] text-cyan-300">② 発掘LAB内で実測したPV・クリック</p>
        <h2 className="mt-1 text-2xl font-black">集客ファネルの現在地</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
          Search ConsoleとGA4の公式計測を、サイト内イベントと区別して表示します。検索クリックとサイト訪問は計測定義が異なり、同一訪問者で結び付けた転換率ではありません。
        </p>
      </div>
      <GoogleAcquisitionCards analytics={googleAnalytics} />
      <RevenueFunnelStages
        affiliateAnalytics={affiliateAnalytics}
        googleAnalytics={googleAnalytics}
        id990Daily={id990Daily}
        id990Confirmed={id990Confirmed}
        thirtyDayTotal={thirtyDayTotal}
      />
      <p className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs leading-5 text-amber-200">
        期間と帰属範囲が異なる段階を並べた全体像です。現在は厳密な一続きのCVファネルや各段階の転換率として比較できません。
      </p>
    </section>
  );
}
