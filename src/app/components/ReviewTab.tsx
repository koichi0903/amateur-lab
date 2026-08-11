import type { Work } from "@/types/work";

type Props = {
  work: Work;
  summary: string;
  goodPoints: string[];
  cautionPoints: string[];
  conclusion: string;
};

export default function ReviewTab({
  work,
  summary,
  goodPoints,
  cautionPoints,
  conclusion,
}: Props) {

const review = work.review_average ?? 0;

const stars =
  "★★★★★"
    .slice(0, Math.round(review)) +
  "☆☆☆☆☆".slice(Math.round(review));

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">

      <h2 className="text-3xl font-black">
        ⭐ レビュー分析
      </h2>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">

        <div className="rounded-2xl border border-zinc-200 p-8 text-center">

          <div className="text-sm text-zinc-500">
            総合評価
          </div>

          <div className="mt-3 text-6xl font-black text-pink-600">
            {work.review_average ?? "-"}
          </div>

          <div className="mt-4 text-2xl text-yellow-500">
  {stars}
</div>
          <div className="mt-3 text-sm text-zinc-500">
            レビュー数：
            {work.review_count ?? 0}件
          </div>

        </div>

        <div className="rounded-2xl border border-zinc-200 p-8">

          <h3 className="text-xl font-black">
  🤖 AIレビュー要約
</h3>

<p className="mt-6 leading-8 text-zinc-700">
  {summary}
</p>

<div className="mt-8 grid gap-5 md:grid-cols-2">

  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">

    <div className="font-bold text-emerald-700">
      👍 良かった点
    </div>

    <ul className="mt-3 space-y-2 text-sm leading-7">

  {goodPoints.map((point) => (
    <li key={point}>
      ・{point}
    </li>
  ))}

</ul>

  </div>

  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">

    <div className="font-bold text-amber-700">
      👀 気になる点
    </div>

    <ul className="mt-3 space-y-2 text-sm leading-7">

  {cautionPoints.map((point) => (
    <li key={point}>
      ・{point}
    </li>
  ))}

</ul>

  </div>

</div>

<div className="mt-8 rounded-2xl bg-pink-50 p-6">

  <h4 className="font-black text-pink-700">
    📌 AI総合コメント
  </h4>

  <p className="mt-4 leading-8 text-zinc-700">
  {conclusion}
</p>

</div>

        </div>

      </div>

    </section>
  );
}