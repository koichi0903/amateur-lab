import RadarChart from "./RadarChart";
import PriceChart from "./PriceChart";
import type { Work } from "@/types/work";
import RecommendationReasons from "./RecommendationReasons";
import type { RecommendReason } from "@/lib/analyzers/recommendAnalyzer";

type PricePoint = {
  date: string;
  price: number;
};

type Props = {
  work: Work;
  chartData?: PricePoint[];
  recommendationReasons: RecommendReason[];
};

function getDecisionSupportPoint(work: Work) {
  const detailWork = work as Work & { sample_movie_url?: string | null };
  const currentPrice = work.sale_price && work.sale_price > 0 ? work.sale_price : work.price;
  const enoughInfoCount = [
    work.actress,
    work.genre,
    work.maker,
    work.release_date,
    currentPrice,
  ].filter(Boolean).length;

  return (
    (detailWork.sample_movie_url ? 3 : 0) +
    (work.image_url ? 1 : 0) +
    (enoughInfoCount >= 4 ? 1 : 0)
  );
}

function ScoreAnalysisCard({ work, className }: { work: Work; className: string }) {
  return (
    <div className={`${className} min-w-0 flex-col items-center rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5`}>
      <h3 className="text-xl font-black">
        おすすめ要素のバランス
      </h3>

      <div className="w-full md:max-w-[320px]">
        <RadarChart
          quality={work.review_score ?? 0}
          trust={work.review_count_score ?? 0}
          discovery={work.ranking_score ?? 0}
          timing={work.discount_score ?? 0}
          decision={getDecisionSupportPoint(work)}
        />
      </div>
    </div>
  );
}

export default function AIAnalysis({
  work,
  chartData = [],
  recommendationReasons,
}: Props) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white shadow-sm">

      {/* タイトル */}
      <div className="border-b px-4 py-5 sm:px-8 sm:py-6">

        <h2 className="text-2xl font-black sm:text-3xl">
          🔥 AIがこの作品をおすすめする理由
        </h2>

        <p className="mt-2 text-zinc-500">
          価格・レビュー・人気・作品データから、基準を満たした理由だけを表示します
        </p>

      </div>

      <div className="p-4 sm:p-8">

        {/* 左側 */}
        <div>

          {/* 上段 */}
          <div className="grid min-w-0 items-start gap-4 md:grid-cols-2">
  <RecommendationReasons reasons={recommendationReasons} />

  {/* レーダー */}
<ScoreAnalysisCard work={work} className="flex" />

</div>

          {/* 下段 */}
          <div className="-mx-4 mt-4 min-w-0 border-y bg-white px-2 py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-6">

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
