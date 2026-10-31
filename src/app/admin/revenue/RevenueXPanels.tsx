import Link from "next/link";
import type { getAffiliateAnalytics } from "@/lib/affiliateAnalytics";
import { formatJstDateTime as formatDateTime } from "@/lib/dateTime";

export { formatDateTime };

export function MetricCard({
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
type XPostCategoryRevenue = Awaited<ReturnType<typeof getAffiliateAnalytics>>["xPostCategoryRevenue"];

export function XTrafficPanel({ xTraffic }: { xTraffic: XTraffic }) {
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

export function XPostCategoryRevenuePanel({
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

