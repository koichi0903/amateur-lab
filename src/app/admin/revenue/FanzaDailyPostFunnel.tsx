import Link from "next/link";
import { getFanzaDailyPostFunnel } from "@/lib/fanzaDailyPostFunnel";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export default async function FanzaDailyPostFunnel() {
  const result = await getFanzaDailyPostFunnel(30);
  return (
    <section className="mt-6 rounded-2xl border border-violet-900/70 bg-violet-950/15 p-5 sm:p-6">
      <div>
        <p className="text-xs font-black tracking-[0.16em] text-violet-300">X POST → SITE → FANZA</p>
        <h3 className="mt-1 text-lg font-black">投稿別ファネル（直近30日投稿）</h3>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          投稿IDに紐付くX表示数と、同じ投稿キーの作品PV・FANZA CTAを並べます。主数値は投稿後24時間、補足は7日間。いずれもイベント数で、購入数ではありません。
        </p>
      </div>
      {result.error ? (
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">投稿別データを取得できません: {result.error}</p>
      ) : !result.rows.length ? (
        <p className="mt-4 rounded-lg bg-zinc-950 p-4 text-sm text-zinc-400">対象期間の投稿ログはありません。</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-zinc-950">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="text-[11px] text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-3">入口 / 投稿</th>
                <th className="px-3 py-3">投稿日時</th>
                <th className="px-3 py-3 text-right">X表示・24h</th>
                <th className="px-3 py-3 text-right">作品PV</th>
                <th className="px-3 py-3 text-right">FANZA CTA</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={`${row.account}:${row.postKey}`} className="border-b border-zinc-900 align-top last:border-0">
                  <td className="max-w-[340px] px-3 py-3">
                    <p className="text-[11px] font-black text-violet-300">@{row.account}</p>
                    <Link href={`/works/${row.workId}`} className="mt-1 block truncate font-bold text-zinc-200 hover:text-violet-300">{row.title}</Link>
                    <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">{row.postKey}</p>
                    {row.xPostId ? <a href={`https://x.com/${row.account}/status/${row.xPostId}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-cyan-400 hover:underline">X投稿を開く</a> : <p className="mt-1 text-[10px] text-amber-300">X投稿ID未登録</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-zinc-400">{dateTime(row.postedAt)}</td>
                  <td className="px-3 py-3 text-right font-black text-white">
                    {row.impressions24h === null ? <span className="text-amber-300">未取得</span> : row.impressions24h.toLocaleString("ja-JP")}
                    {row.impressionCapturedAt && <span className="mt-1 block text-[10px] font-normal text-zinc-600">取得 {dateTime(row.impressionCapturedAt)}</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-black text-cyan-300">
                    {row.siteViews24h.toLocaleString("ja-JP")}<span className="mt-1 block text-[10px] font-normal text-zinc-600">7日 {row.siteViews7d.toLocaleString("ja-JP")}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-black text-emerald-300">
                    {row.fanzaClicks24h.toLocaleString("ja-JP")}<span className="mt-1 block text-[10px] font-normal text-zinc-600">7日 {row.fanzaClicks7d.toLocaleString("ja-JP")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-5 text-zinc-500">
        キーのないクリック・PVは投稿に割り当てません。FANZA公式ID 990のクリック・成果はこのサイト内イベントと別に、公式レポートの対象期間とIDを確認してください。
      </p>
    </section>
  );
}
