import type { getFanzaId990DailyOfficialMetrics } from "@/lib/fanzaId990DailyOfficialMetrics";
import FanzaId990DailyOfficialInput from "./FanzaId990DailyOfficialInput";
import { formatDateTime, MetricCard } from "./RevenueXPanels";

type DailyReport = Awaited<ReturnType<typeof getFanzaId990DailyOfficialMetrics>>;

type ConfirmedSummary = {
  dayCount: number;
  clickCount: number;
  rewardYen: number;
};

export default function FanzaId990DailyOfficialPanel({
  report,
  confirmed,
}: {
  report: DailyReport;
  confirmed: ConfirmedSummary;
}) {
  return (
    <div className="mt-7 border-t border-emerald-900/70 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-emerald-300">DMM OFFICIAL DAILY · ID 990</p>
          <h3 className="mt-1 text-lg font-black">公式日別クリック・報酬</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-400">対象 {report.fromDate}〜{report.untilDate}。DMM公式画面からの手入力です。サイト内イベント・ID026・全体CSVとは別集計です。</p>
        </div>
        {!report.error && <p className="text-xs text-zinc-500">確定値のみ集計 / 記録 {confirmed.dayCount}日</p>}
      </div>

      {report.error ? (
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/20 p-3 text-xs leading-5 text-amber-200">日別公式テーブルを読み込めません。DB設定反映後に利用できます。エラー: {report.error}</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetricCard label="ID990 確定クリック（30日）" value={confirmed.dayCount ? `${confirmed.clickCount.toLocaleString("ja-JP")}回` : "未記録"} note={`DMM公式の日別確定値。${confirmed.dayCount}日分のみ。未記録日は含みません。`} />
            <MetricCard label="ID990 確定報酬（30日）" value={confirmed.dayCount ? `¥${confirmed.rewardYen.toLocaleString("ja-JP")}` : "未記録"} note="ダイレクト・カテゴリ・サービス新規の合計" />
            <MetricCard label="速報・未確定日" value={`${report.rows.filter((row) => row.report_status === "provisional").length}日`} note="確定値の合計からは除外" />
          </div>
          <FanzaId990DailyOfficialInput />
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-zinc-900 text-zinc-400"><tr><th className="px-3 py-3">対象日</th><th className="px-3 py-3 text-right">公式クリック</th><th className="px-3 py-3 text-right">成果件数</th><th className="px-3 py-3 text-right">報酬額</th><th className="px-3 py-3">状態</th><th className="px-3 py-3">確認日時</th></tr></thead>
              <tbody className="divide-y divide-zinc-800">
                {report.rows.length ? report.rows.slice(0, 10).map((row) => {
                  const rewardCount = row.direct_reward_count + row.category_reward_count + row.service_reward_count;
                  const rewardYen = row.direct_reward_yen + row.category_reward_yen + row.service_reward_yen;
                  return <tr key={row.report_date}>
                    <td className="px-3 py-3 font-bold text-zinc-200">{row.report_date}</td>
                    <td className="px-3 py-3 text-right font-black text-cyan-200">{row.click_count.toLocaleString("ja-JP")}</td>
                    <td className="px-3 py-3 text-right text-zinc-300">{rewardCount.toLocaleString("ja-JP")}</td>
                    <td className="px-3 py-3 text-right font-black text-emerald-300">¥{rewardYen.toLocaleString("ja-JP")}</td>
                    <td className="px-3 py-3">{row.report_status === "confirmed" ? <span className="text-emerald-300">確定</span> : <span className="text-amber-300">速報</span>}</td>
                    <td className="px-3 py-3 text-zinc-500">{formatDateTime(row.observed_at)}</td>
                  </tr>;
                }) : <tr><td colSpan={6} className="px-3 py-5 text-center text-zinc-500">日別レポートは未記録です。未記録は0件として集計していません。</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
