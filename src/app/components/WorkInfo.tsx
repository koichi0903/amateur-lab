import type { Work } from "@/types/work";

type Props = {
  work: Work;
};

export default function WorkInfo({
  work,
}: Props) {

  return (
    <div className="space-y-8">

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
