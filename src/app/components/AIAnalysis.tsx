import RadarChart from "./RadarChart";
import PriceChart from "./PriceChart";
import type { Work } from "@/types/work";

type PricePoint = {
  date: string;
  price: number;
};

type Props = {
  work: Work;
  summary: string;
  comments: string[];
  chartData?: PricePoint[];
};

export default function AIAnalysis({
  work,
  summary,
  comments,
  chartData = [],
}: Props) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white shadow-sm">

      {/* タイトル */}
      <div className="border-b px-4 py-5 sm:px-8 sm:py-6">

        <h2 className="text-2xl font-black sm:text-3xl">
          🤖 AI分析レポート
        </h2>

        <p className="mt-2 text-zinc-500">
          発掘LAB AIが作品を総合分析しました
        </p>

      </div>

      <div className="p-4 sm:p-8">

        {/* 左側 */}
        <div>

          {/* 上段 */}
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
  {/* AIレポート */}
  <div className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:min-h-[430px] sm:p-6">

    <h3 className="text-lg font-black">
      AI分析レポート
    </h3>

    <p className="mt-4 text-[15px] leading-8 text-zinc-700">
  {summary}
</p>

<div className="mt-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">

  {comments.slice(0, 4).map((comment, index) => (

    <div
  key={index}
  className={`
    rounded-xl border p-4 transition
    hover:-translate-y-1 hover:shadow-md
    ${
      index === 0
        ? "border-yellow-200 bg-yellow-50"
        : index === 1
        ? "border-red-200 bg-red-50"
        : index === 2
        ? "border-emerald-200 bg-emerald-50"
        : "border-pink-200 bg-pink-50"
    }
  `}
>

<div className="mt-2 whitespace-pre-line text-[13px] font-semibold leading-6 text-zinc-700">
  {comment}
</div>

    </div>

  ))}

</div>

  </div>

  {/* レーダー */}
<div className="flex min-w-0 flex-col items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 sm:min-h-[430px] sm:p-6">

  <h3 className="text-xl font-black">
  発掘スコア分析
</h3>

  <RadarChart
  actress={work.actress_point ?? 0}
  review={work.review_score ?? 0}
  popularity={work.ranking_score ?? 0}
  maker={work.maker_score ?? 0}
  genre={work.genre_score ?? 0}
  series={work.series_score ?? 0}
/>
<p className="mt-6 text-center text-sm leading-7 text-zinc-600">

  6項目を独自アルゴリズムで
分析した発掘スコアです。

</p>

</div>

</div>

          {/* 下段 */}
          <div className="mt-8 min-w-0 rounded-2xl border bg-white p-4 sm:mt-10 sm:p-6">

            <h3 className="mb-6 text-xl font-black sm:text-2xl">
              📈 価格推移
            </h3>

            <PriceChart
              data={chartData}
            />

          </div>

        </div>

      </div>

    </section>
  );
}
