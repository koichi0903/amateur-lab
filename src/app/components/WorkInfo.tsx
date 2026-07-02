import type { Work } from "@/types/work";

type Props = {
  work: Work;
};

const ScoreBar = ({
  value,
  max,
}: {
  value: number;
  max: number;
}) => (
  <div className="flex items-center gap-3">

    <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">

      <div
        className="h-full rounded-full bg-indigo-600"
        style={{
  width: `${Math.min((value / max) * 100, 100)}%`,
}}
      />

    </div>

    <span className="w-16 text-right font-bold text-sm">
  {value} / {max}
</span>

  </div>
);

export default function WorkInfo({
  work,
}: Props) {
  return (
    <>
      <div className="mt-6 bg-white border rounded-xl p-5">

        <h2 className="text-lg font-bold mb-4">
          📊 発掘スコア内訳
        </h2>

        <div className="space-y-4">

  <div>
    <p className="mb-1">👩 女優</p>
    <ScoreBar value={work.actress_point} max={20} />
  </div>

  <div>
    <p className="mb-1">🏷 ジャンル</p>
    <ScoreBar value={work.genre_point} max={15} />
  </div>

  <div>
    <p className="mb-1">🏢 メーカー</p>
    <ScoreBar value={work.maker_point} max={5} />
  </div>

  <div>
    <p className="mb-1">📚 シリーズ</p>
    <ScoreBar value={work.series_point} max={5} />
  </div>

  <div>
    <p className="mb-1">⭐ レビュー</p>
    <ScoreBar value={work.review_score} max={15} />
  </div>

  <div>
    <p className="mb-1">📝 レビュー件数</p>
    <ScoreBar value={work.review_count_score} max={5} />
  </div>

  <div>
    <p className="mb-1">💰 割引</p>
    <ScoreBar value={work.discount_score} max={5} />
  </div>

  <div>
    <p className="mb-1">🏆 ランキング</p>
    <ScoreBar value={work.ranking_score} max={20} />
  </div>

  <div>
    <p className="mb-1">🆕 新作</p>
    <ScoreBar value={work.new_release_score} max={10} />
  </div>

</div>
      </div>

      <div className="mt-6 bg-white border rounded-xl p-5">

        <h2 className="text-lg font-bold mb-4">
          📋 作品情報
        </h2>

        <div className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">

  <div className="font-bold text-gray-500">
    女優
  </div>
  <div>
    {work.actress || "不明"}
  </div>

  <div className="font-bold text-gray-500">
    メーカー
  </div>
  <div>{work.maker || "不明"}</div>

          <div className="font-bold text-gray-500">
            シリーズ
          </div>
          <div>{work.series || "なし"}</div>

          <div className="font-bold text-gray-500">
  ジャンル
</div>

<div>
  {work.genre || "不明"}
</div>

          <div className="font-bold text-gray-500">
            発売日
          </div>
          <div>{work.release_date || "不明"}</div>

          <div className="font-bold text-gray-500">
            品番
          </div>
          <div>{work.product_id || "-"}</div>

        </div>

      </div>
    </>
  );
}