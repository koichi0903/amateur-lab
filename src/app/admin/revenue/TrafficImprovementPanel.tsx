import { Route, Smartphone } from "lucide-react";
import type {
  TrafficInsight,
  TrafficInsightAction,
} from "@/lib/affiliateAnalytics";

const actionLabels: Record<TrafficInsightAction, string> = {
  expand: "露出強化",
  maintain: "現状維持",
  recover: "要回復",
  observe: "データ蓄積",
};

const actionStyles: Record<TrafficInsightAction, string> = {
  expand: "border-emerald-800 bg-emerald-950/50 text-emerald-300",
  maintain: "border-cyan-900 bg-cyan-950/40 text-cyan-300",
  recover: "border-red-900 bg-red-950/50 text-red-300",
  observe: "border-zinc-700 bg-zinc-800 text-zinc-300",
};

function TrendValue({ insight }: { insight: TrafficInsight }) {
  if (insight.previousSevenDays === 0) {
    return (
      <span className="text-zinc-400">
        {insight.lastSevenDays > 0 ? "新規" : "変化なし"}
      </span>
    );
  }

  const growthRate = insight.growthRate ?? 0;
  const color = growthRate > 0
    ? "text-emerald-300"
    : growthRate < 0
      ? "text-red-300"
      : "text-zinc-400";
  return (
    <span className={color}>
      {growthRate > 0 ? "+" : ""}{growthRate}%
    </span>
  );
}

function InsightTable({
  title,
  description,
  insights,
  kind,
}: {
  title: string;
  description: string;
  insights: TrafficInsight[];
  kind: "source" | "placement";
}) {
  const Icon = kind === "source" ? Route : Smartphone;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0 text-violet-400" size={21} />
        <div>
          <h2 className="font-black">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="pb-3 pr-4">対象</th>
              <th className="pb-3 pr-4 text-right">30日</th>
              <th className="pb-3 pr-4 text-right">構成比</th>
              <th className="pb-3 pr-4 text-right">直近7日</th>
              <th className="pb-3 pr-4 text-right">前7日</th>
              <th className="pb-3 pr-4 text-right">増減</th>
              <th className="pb-3">改善判定</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {insights.map((insight) => (
              <tr key={insight.key}>
                <td className="py-3 pr-4 font-bold text-zinc-200">
                  {insight.label}
                </td>
                <td className="py-3 pr-4 text-right font-black">
                  {insight.total.toLocaleString("ja-JP")}
                </td>
                <td className="py-3 pr-4 text-right text-zinc-400">
                  {insight.share}%
                </td>
                <td className="py-3 pr-4 text-right text-zinc-300">
                  {insight.lastSevenDays.toLocaleString("ja-JP")}
                </td>
                <td className="py-3 pr-4 text-right text-zinc-400">
                  {insight.previousSevenDays.toLocaleString("ja-JP")}
                </td>
                <td className="py-3 pr-4 text-right font-black">
                  <TrendValue insight={insight} />
                </td>
                <td className="py-3">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-black ${actionStyles[insight.action]}`}>
                    {actionLabels[insight.action]}
                  </span>
                  <p className="mt-1 max-w-xs text-[11px] leading-4 text-zinc-500">
                    {insight.actionReason}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!insights.length && (
          <p className="py-6 text-sm text-zinc-500">
            判定できるクリックデータはまだありません。
          </p>
        )}
      </div>
    </section>
  );
}

export default function TrafficImprovementPanel({
  sourceInsights,
  placementInsights,
}: {
  sourceInsights: TrafficInsight[];
  placementInsights: TrafficInsight[];
}) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <InsightTable
        title="流入元の改善判定"
        description="直近7日とその前7日のクリック推移から、伸ばす流入元と回復が必要な流入元を判定します。"
        insights={sourceInsights}
        kind="source"
      />
      <InsightTable
        title="CTA位置の改善判定"
        description="CTA位置ごとのクリック推移を比較します。売上の流入元別ひも付けがないため、ここではクリック傾向だけを判定します。"
        insights={placementInsights}
        kind="placement"
      />
    </div>
  );
}
