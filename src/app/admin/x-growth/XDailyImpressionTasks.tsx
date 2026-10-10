import Link from "next/link";
import { getFanzaDailyPostFunnel } from "@/lib/fanzaDailyPostFunnel";
import ManualXImpressionInput from "./ManualXImpressionInput";

const HOUR_MS = 60 * 60 * 1000;

function formatJst(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export default async function XDailyImpressionTasks() {
  const result = await getFanzaDailyPostFunnel(7);
  const now = Date.parse(result.evaluatedAt);
  const posts = result.rows.filter((row) => row.xPostId);
  const due = posts.filter((row) => row.canRecordImpressions);
  const upcoming = posts
    .filter((row) => row.impressions24h === null && !row.canRecordImpressions)
    .map((row) => ({ row, ageHours: (now - Date.parse(row.postedAt)) / HOUR_MS }))
    .filter(({ ageHours }) => ageHours >= 20 && ageHours < 24)
    .sort((a, b) => a.ageHours - b.ageHours);
  const recorded = posts.filter((row) => row.impressions24h !== null).slice(0, 5);
  const expiredCount = posts.filter((row) => {
    const ageHours = (now - Date.parse(row.postedAt)) / HOUR_MS;
    return row.impressions24h === null && ageHours >= 27;
  }).length;

  return (
    <section id="x-daily-impression-tasks" className="mt-6 scroll-mt-6 rounded-2xl border border-emerald-800 bg-emerald-950/15 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-emerald-300">NO X API / MANUAL CHECK</p>
          <h2 className="mt-1 text-xl font-black">Xデイリータスク：投稿24時間前後の表示数</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-400">
            X投稿を開き、表示回数を入力します。投稿から24〜27時間後の時点値を、同じ時間帯の作品PV・FANZA CTAと並べて確認できます。厳密な24時間累計やユニーク人数ではありません。
          </p>
        </div>
        <Link href="/admin/revenue#fanza-daily-post-funnel" className="rounded-lg border border-emerald-800 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-950">
          FANZA分析でも入力する
        </Link>
      </div>

      {result.error ? (
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">投稿記録を読み込めませんでした: {result.error}</p>
      ) : due.length ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {due.map((row) => (
            <article key={`${row.account}:${row.postKey}`} className="rounded-xl border border-emerald-700 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-emerald-300">@{row.account} / 今すぐ記録</p>
                  <p className="mt-1 font-bold text-white">{row.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">投稿 {formatJst(row.postedAt)} / キー {row.postKey}</p>
                </div>
                <a href={`https://x.com/${row.account}/status/${row.xPostId}`} target="_blank" rel="noreferrer" className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-black text-cyan-200 hover:bg-zinc-700">
                  X投稿を開く ↗
                </a>
              </div>
              <ManualXImpressionInput postKey={row.postKey} account={row.account} />
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">今すぐ記録する投稿はありません。24時間に達するとここに表示されます。</p>
      )}

      {!!upcoming.length && (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs font-black text-zinc-300">まもなく計測（投稿後24時間）</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
            {upcoming.slice(0, 5).map(({ row, ageHours }) => <span key={row.postKey}>@{row.account} {row.title} — あと約{Math.ceil(24 - ageHours)}時間</span>)}
          </div>
        </div>
      )}

      {!!recorded.length && (
        <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <summary className="cursor-pointer text-xs font-black text-zinc-300">記録済みの最近の投稿（{recorded.length}件）</summary>
          <div className="mt-2 space-y-2">
            {recorded.map((row) => (
              <div key={row.postKey} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-400">@{row.account} · {row.title}</span>
                <span className="font-black text-white">{row.impressions24h?.toLocaleString("ja-JP")}回</span>
                {row.xPostId && <a href={`https://x.com/${row.account}/status/${row.xPostId}`} target="_blank" rel="noreferrer" className="text-cyan-300">X投稿 ↗</a>}
              </div>
            ))}
          </div>
        </details>
      )}

      {!!expiredCount && <p className="mt-3 text-[11px] text-amber-300">24時間計測の入力期限を過ぎた未記録投稿が{expiredCount}件あります。過去の正確な24時間値は後から復元できないため、0にはせず未取得として残しています。</p>}
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">API認証や課金は使いません。X画面の数値を保存し、サイトの投稿別PV・FANZA CTAは自動集計します。</p>
    </section>
  );
}
