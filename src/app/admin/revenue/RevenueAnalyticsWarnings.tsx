import type { getAffiliateAnalytics } from "@/lib/affiliateAnalytics";

type Props = {
  analytics: Awaited<ReturnType<typeof getAffiliateAnalytics>>;
};

export default function RevenueAnalyticsWarnings({ analytics }: Props) {
  return (
    <>
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
    </>
  );
}
