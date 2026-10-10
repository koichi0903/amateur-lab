import Link from "next/link";
import { getFanzaDailyPostFunnel } from "@/lib/fanzaDailyPostFunnel";
import ManualXImpressionInput from "./ManualXImpressionInput";
import RegisterXPostUrlInput from "./RegisterXPostUrlInput";

const HOUR_MS = 60 * 60 * 1000;

function formatJst(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export default async function XDailyImpressionTasks() {
  const result = await getFanzaDailyPostFunnel(30);
  const now = Date.parse(result.evaluatedAt);
  const posts = result.rows;
  const unlinked = posts.filter((row) => !row.xPostId);
  const linkedPosts = posts.filter((row) => row.xPostId);
  const due = linkedPosts.filter((row) => row.canRecordImpressions);
  const upcoming = linkedPosts
    .filter((row) => row.impressionsAtCapture === null && !row.canRecordImpressions)
    .map((row) => ({ row, ageHours: (now - Date.parse(row.postedAt)) / HOUR_MS }))
    .filter(({ ageHours }) => ageHours >= 20 && ageHours < 24)
    .sort((a, b) => a.ageHours - b.ageHours);
  const recorded = linkedPosts.filter((row) => row.impressionsAtCapture !== null).slice(0, 5);
  const lateCount = linkedPosts.filter((row) => {
    const ageHours = (now - Date.parse(row.postedAt)) / HOUR_MS;
    return row.impressionsAtCapture === null && ageHours >= 27 && ageHours < 30 * 24;
  }).length;

  return (
    <section id="x-daily-impression-tasks" className="mt-6 scroll-mt-6 rounded-2xl border border-emerald-800 bg-emerald-950/15 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-emerald-300">NO X API / MANUAL CHECK</p>
          <h2 className="mt-1 text-xl font-black">Xデイリータスク：投稿表示数の記録</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-400">
            X投稿を開き、表示回数を入力します。投稿から24時間以上たった後なら記録でき、入力時刻までの作品PV・FANZA CTAと照合します。表示数は入力時点の累計値です。
          </p>
        </div>
        <Link href="/admin/revenue#fanza-daily-post-funnel" className="rounded-lg border border-emerald-800 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-950">
          FANZA分析を見る
        </Link>
      </div>

      {result.error ? (
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">投稿記録を読み込めませんでした: {result.error}</p>
      ) : (
        <>
        {!!unlinked.length && <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100">投稿URLがまだ登録されていないため、閲覧数を記録できない投稿があります。X投稿URLを一度登録すると、ここに入力タスクが表示されます。</p>
          {unlinked.map((row) => (
            <article key={`${row.account}:${row.postKey}`} className="rounded-xl border border-amber-800 bg-zinc-950 p-4">
              <p className="text-xs font-black text-amber-200">@{row.account} / X投稿URL未登録</p>
              <p className="mt-1 font-bold text-white">{row.title}</p>
              <p className="mt-1 text-[11px] text-zinc-500">投稿 {formatJst(row.postedAt)} / キー {row.postKey}</p>
              <RegisterXPostUrlInput postKey={row.postKey} account={row.account} />
            </article>
          ))}
        </div>}

        {due.length ? <div className="mt-4 grid gap-3 xl:grid-cols-2">
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
        : <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">今すぐ記録する投稿はありません。X投稿URLを登録済みなら、投稿から24時間後に表示されます。</p>}

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
                <span className="font-black text-white">{row.impressionsAtCapture?.toLocaleString("ja-JP")}回</span>
                {row.xPostId && <a href={`https://x.com/${row.account}/status/${row.xPostId}`} target="_blank" rel="noreferrer" className="text-cyan-300">X投稿 ↗</a>}
              </div>
            ))}
          </div>
        </details>
      )}

      {!!lateCount && <p className="mt-3 text-[11px] text-amber-300">投稿後27時間を過ぎた未記録が{lateCount}件あります。今からでも現在の表示数を記録できます。24時間ちょうどの値としては扱いません。</p>}
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">API認証や課金は使いません。X画面の表示数は手入力、投稿別PV・FANZA CTAは自動集計します。対象期間は直近30日投稿です。</p>
        </>
      )}
    </section>
  );
}
