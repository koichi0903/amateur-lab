import type { Work } from "@/types/work";
import ScoreBar from "./ScoreBar";

type Props = {
  work: Work;
};

const scores = [
  { label: "👩 女優", valueKey: "actress_point", max: 20 },
  { label: "🏷 ジャンル", valueKey: "genre_point", max: 10 },
  { label: "🏢 メーカー", valueKey: "maker_point", max: 10 },
  { label: "📚 シリーズ", valueKey: "series_point", max: 10 },
  { label: "⭐ レビュー", valueKey: "review_score", max: 15 },
  { label: "📝 レビュー件数", valueKey: "review_count_score", max: 10 },
  { label: "💰 割引", valueKey: "discount_score", max: 10 },
  { label: "🏆 人気度", valueKey: "ranking_score", max: 25 },
] as const;

export default function WorkInfo({
  work,
}: Props) {

 const baseScore =
  work.actress_point +
  work.genre_point +
  work.maker_point +
  work.series_point +
  work.review_score +
  work.review_count_score +
  work.discount_score +
  work.ranking_score;

const bonusScore =
  work.new_release_score +
  work.long_hit_point;

  return (
    <div className="space-y-8">

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">

        <h2 className="mb-6 text-2xl font-black">
          📊 発掘スコア内訳
        </h2>

        <h3 className="mb-4 text-lg font-black text-zinc-700">
  基本スコア
</h3>

<div className="space-y-5">

          {scores.map((item) => (
            <div key={item.label}>

              <div className="mb-2 flex justify-between text-sm font-semibold">

                <span>{item.label}</span>

                <span>
                  {work[item.valueKey]}/{item.max}
                </span>

              </div>

              <ScoreBar
                value={work[item.valueKey]}
                max={item.max}
              />

            </div>
          ))}

        </div>

       <h3 className="mt-8 mb-4 text-lg font-black text-pink-700">
  ✨ ボーナス
</h3>

<div className="space-y-5">

  <div>
    <div className="mb-2 flex justify-between text-sm font-semibold">
      <span>🆕 新作ボーナス</span>
      <span>{work.new_release_score}/10</span>
    </div>

    <ScoreBar
      value={work.new_release_score}
      max={10}
    />
  </div>

  <div>
    <div className="mb-2 flex justify-between text-sm font-semibold">
      <span>🔥 ロングヒット</span>
      <span>{work.long_hit_point}/10</span>
    </div>

    <ScoreBar
      value={work.long_hit_point}
      max={10}
    />
  </div>

</div>

        <div className="mt-8 rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-6">

  <div className="flex items-center justify-between">

    <span className="text-base font-bold text-zinc-600">
      基本スコア
    </span>

    <span className="text-2xl font-black">
      {baseScore}
    </span>

  </div>

  <div className="py-3 text-center text-3xl font-black text-pink-500">
    ＋
  </div>

  <div className="flex items-center justify-between">

    <span className="text-base font-bold text-zinc-600">
      ボーナス
    </span>

    <span className="text-2xl font-black text-orange-500">
      {bonusScore}
    </span>

  </div>

  <div className="my-5 border-t border-dashed border-pink-300"></div>

  <div className="flex items-center justify-between">

    <span className="text-xl font-black">
      発掘スコア
    </span>

    <div className="text-right">

      <div className="text-4xl font-black text-pink-600">
        {work.score}
        <span className="ml-1 text-xl text-zinc-400">
          /100
        </span>
      </div>

    </div>

  </div>

</div>

      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">

        <h2 className="mb-6 text-2xl font-black">
          📄 作品情報
        </h2>

        <div className="grid gap-4 md:grid-cols-2">

          <InfoCard title="👩 女優" value={work.actress || "不明"} />
          <InfoCard title="🏢 メーカー" value={work.maker || "不明"} />
          <InfoCard title="📚 シリーズ" value={work.series || "なし"} />
          <InfoCard title="🏷 ジャンル" value={work.genre || "不明"} />
          <InfoCard title="📅 発売日" value={work.release_date || "不明"} />
          <InfoCard title="🆔 品番" value={work.product_id || "-"} />
          <InfoCard
  title="⭐ レビュー評価"
  value={
    work.review_average
      ? `${work.review_average} / 5.0`
      : "-"
  }
/>

<InfoCard
  title="💬 レビュー件数"
  value={`${work.review_count ?? 0}件`}
/>

<InfoCard
  title="🏆 ランキング"
  value={
    work.ranking
      ? `${work.ranking}位`
      : "-"
  }
/>

<InfoCard
  title="💰 現在価格"
  value={`¥${(
    work.sale_price ??
    work.price ??
    0
  ).toLocaleString()}`}
/>

        </div>

      </section>

    </div>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 p-4">

      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>

      <div className="mt-2 text-base font-bold text-zinc-900">
        {value}
      </div>

    </div>
  );
}
