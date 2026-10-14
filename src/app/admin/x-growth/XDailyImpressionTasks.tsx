import Link from "next/link";
import { getFanzaDailyPostFunnel } from "@/lib/fanzaDailyPostFunnel";
import XDailyTaskQueue from "./XDailyTaskQueue";

const HOUR_MS = 60 * 60 * 1000;

function formatJst(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export default async function XDailyImpressionTasks() {
  // The manual capture API accepts posts up to 30 days old. Keep the task queue
  // on the same window so eligible posts do not silently disappear after day 7.
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
  const recorded = linkedPosts.filter((row) => row.impressionsAtCapture !== null).sort((a, b) => Date.parse(b.impressionCapturedAt ?? "") - Date.parse(a.impressionCapturedAt ?? ""));
  const recentRecorded = recorded.slice(0, 5);
  const accountCounts = (account: "hakkutsu_lab" | "bijyo1010") => ({
    unlinked: unlinked.filter((row) => row.account === account).length,
    due: due.filter((row) => row.account === account).length,
    recorded: recorded.filter((row) => row.account === account).length,
  });
  const lateCount = linkedPosts.filter((row) => row.impressionsAtCapture === null && (now - Date.parse(row.postedAt)) / HOUR_MS >= 27).length;

  return (
    <section id="x-daily-impression-tasks" className="mt-6 scroll-mt-6 rounded-2xl border border-emerald-800 bg-emerald-950/15 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-emerald-300">NO X API / MANUAL CHECK</p>
          <h2 className="mt-1 text-xl font-black">Xデイリータスク：投稿表示数の記録</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-zinc-400">
            2つの投稿入口をまとめて確認します。投稿URLを登録し、24時間後にX画面の表示回数を入力してください。入力時刻までの作品PV・FANZA CTAと照合します。X APIは使いません。
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">タスク集計 {formatJst(result.evaluatedAt)} JST / 対象は直近30日投稿（手入力の受付期間と同じ）</p>
        </div>
        <Link href="/admin/revenue#fanza-daily-post-funnel" className="rounded-lg border border-emerald-800 px-3 py-2 text-xs font-black text-emerald-200 hover:bg-emerald-950">
          FANZA分析を見る
        </Link>
      </div>

      {result.error ? (
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">投稿記録を読み込めませんでした: {result.error}</p>
      ) : (
        <>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-amber-800 bg-amber-950/20 p-3">
            <p className="text-[10px] font-bold text-amber-200">X投稿URLを登録</p>
            <p className="mt-1 text-2xl font-black text-white">{unlinked.length}件</p>
            <p className="mt-1 text-[10px] text-zinc-400">hakkutsu_lab {accountCounts("hakkutsu_lab").unlinked} / bijyo1010 {accountCounts("bijyo1010").unlinked}</p>
          </div>
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
            <p className="text-[10px] font-bold text-emerald-200">今すぐ表示数を入力</p>
            <p className="mt-1 text-2xl font-black text-white">{due.length}件</p>
            <p className="mt-1 text-[10px] text-zinc-400">hakkutsu_lab {accountCounts("hakkutsu_lab").due} / bijyo1010 {accountCounts("bijyo1010").due}</p>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            <p className="text-[10px] font-bold text-zinc-300">表示数を記録済み</p>
            <p className="mt-1 text-2xl font-black text-white">{recorded.length}件</p>
            <p className="mt-1 text-[10px] text-zinc-400">hakkutsu_lab {accountCounts("hakkutsu_lab").recorded} / bijyo1010 {accountCounts("bijyo1010").recorded}</p>
          </div>
        </div>

        {!!unlinked.length && <details className="mt-3 rounded-lg border border-amber-800 bg-zinc-950 p-3" open>
          <summary className="cursor-pointer text-xs font-black text-amber-100">先にX投稿URLを登録する（{unlinked.length}件）</summary>
          <p className="mt-2 text-[11px] leading-5 text-zinc-400">投稿を実際に公開した後、投稿URLを1回登録してください。登録した投稿は24時間経過後に「今すぐ表示数を入力」へ移ります。</p>
          <XDailyTaskQueue kind="unlinked" rows={unlinked.map((row) => ({ postKey: row.postKey, account: row.account, title: row.title, postedAt: row.postedAt }))} />
        </details>}
        {due.length ? (
        <XDailyTaskQueue kind="due" rows={due.map((row) => ({ postKey: row.postKey, account: row.account, title: row.title, postedAt: row.postedAt, xPostId: row.xPostId }))} />
        ) : (
        <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">今すぐ記録する投稿はありません。X投稿URLを登録済みなら、投稿から24時間後にここへ表示されます。</p>
        )}
        </>
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
          <summary className="cursor-pointer text-xs font-black text-zinc-300">記録済みの最近の投稿（全{recorded.length}件 / 最新5件を表示）</summary>
          <div className="mt-2 space-y-2">
            {recentRecorded.map((row) => (
              <div key={row.postKey} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-400">@{row.account} · {row.title}</span>
                <span className="font-black text-white">{row.impressionsAtCapture?.toLocaleString("ja-JP")}回</span>
                {row.xPostId && <a href={`https://x.com/${row.account}/status/${row.xPostId}`} target="_blank" rel="noreferrer" className="text-cyan-300">X投稿 ↗</a>}
              </div>
            ))}
          </div>
        </details>
      )}

      {!!lateCount && <p className="mt-3 text-[11px] text-amber-300">投稿後27時間を超えて未記録の投稿が{lateCount}件あります。今からでも現在の表示数を登録できます。過去の24時間時点の値としては扱わず、登録時刻までのサイトイベントと照合します。</p>}
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">API認証や課金は使いません。X画面の数値を保存し、サイトの投稿別PV・FANZA CTAは自動集計します。</p>
    </section>
  );
}
