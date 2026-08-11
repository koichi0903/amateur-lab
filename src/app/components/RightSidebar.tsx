import ScoreCard from "./ScoreCard";
import type { Work } from "@/types/work";

type Props = {
  work: Work;
};

export default function RightSidebar({
  work,
}: Props) {
  return (
    <aside className="sticky top-6 space-y-6">

  <ScoreCard work={work} />

  <section className="rounded-2xl border bg-white p-6 shadow-sm">

    <h2 className="mb-4 text-xl font-bold">
      📈 人気ランキング
    </h2>

    <div className="flex items-center justify-between">
      <span className="text-zinc-500">
        現在順位
      </span>

      <span className="text-4xl font-black text-pink-600">
        #{work.ranking ?? "-"}
      </span>
    </div>

  </section>

  <section className="rounded-2xl border bg-white p-6 shadow-sm">

    <h2 className="mb-4 text-xl font-bold">
      🔗 関連情報
    </h2>

    <div className="space-y-3">

      {work.actress && (
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          👩 {work.actress}
        </div>
      )}

      {work.maker && (
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          🏢 {work.maker}
        </div>
      )}

      {work.series && (
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          📚 {work.series}
        </div>
      )}

      {work.genre && (
        <div className="rounded-xl bg-zinc-50 px-4 py-3">
          🏷 {work.genre}
        </div>
      )}

    </div>

  </section>

</aside>
  );
}
