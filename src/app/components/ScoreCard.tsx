type Props = {
  work: {
    score: number;

    actress_point: number;
    genre_point: number;
    maker_point: number;
    series_point: number;

    review_score: number;
    review_count_score: number;

    ranking_score: number;
    discount_score: number;

    new_release_score: number;
    long_hit_point: number;

    ranking: number | null;
    review_average: number | null;
    discount_rate: number | null;
  };
};

export default function ScoreCard({
  work,
}: Props) {
  const items = [
  {
    label: "👩 女優",
    value: work.actress_point,
    max: 20,
  },
  {
    label: "⭐ レビュー評価",
    value: work.review_score,
    max: 15,
  },
  {
    label: "💬 レビュー件数",
    value: work.review_count_score,
    max: 10,
  },
  {
    label: "🏆 人気",
    value: work.ranking_score,
    max: 25,
  },
  {
    label: "🏷 ジャンル",
    value: work.genre_point,
    max: 10,
  },
  {
    label: "🏭 メーカー",
    value: work.maker_point,
    max: 10,
  },
  {
    label: "📚 シリーズ",
    value: work.series_point,
    max: 10,
  },
  {
    label: "💸 割引",
    value: work.discount_score,
    max: 10,
  },
  {
    label: "🆕 新作ボーナス",
    value: work.new_release_score,
    max: 10,
  },
  {
    label: "🔥 ロングヒット",
    value: work.long_hit_point,
    max: 10,
  },
];

　const totalPoint = items.reduce(
  (sum, item) => sum + item.value,
  0
);

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">
        発掘スコア
      </h2>

      <div className="mb-6 text-center">
        <div className="text-6xl font-black tracking-tight text-pink-600">
          {work.score}
        </div>
        
        <div className="mt-1 text-2xl tracking-widest text-yellow-500">
  ★★★★★
</div>

        <div className="mt-2 text-sm text-zinc-500">
  {work.score}/100
</div>

<div className="mt-2 inline-flex rounded-full bg-pink-100 px-4 py-1 text-xs font-bold uppercase tracking-wide text-pink-700">
  Sランク
</div>

<div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
  <div className="text-xs font-semibold text-green-700">
    AI判定
  </div>

  <div className="mt-1 text-xl font-black text-green-800">
    今買い
  </div>
</div>
      </div>

      <div className="mb-6 rounded-xl bg-zinc-50 p-4">
  <div className="space-y-2 text-sm">

    <div className="flex justify-between">
      <span>🏆 人気順位</span>
      <span>
        {work.ranking ?? "-"}位
      </span>
    </div>

    <div className="flex justify-between">
      <span>⭐ レビュー</span>
      <span>
        {work.review_average ?? "-"}
      </span>
    </div>

    <div className="flex justify-between">
      <span>💰 割引率</span>
      <span>
        {work.discount_rate ?? 0}%
      </span>
    </div>

  </div>
</div>

      <div className="space-y-5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{item.label}</span>

              <span>
                {item.value}/{item.max}
              </span>
            </div>

            <div className="h-3 rounded-full bg-zinc-200">
              <div
  className="h-3 rounded-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500"
                style={{
                  width: `${
                    (item.value / item.max) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t pt-5">

  <div className="flex items-center justify-between">

    <span className="text-lg font-black">
      合計
    </span>

    <span className="text-2xl font-black text-pink-600">
      {totalPoint}/100
    </span>

  </div>

</div>
    </section>
  );
}
