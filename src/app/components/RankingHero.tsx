import WorkCard from "./WorkCard";
import type { Work } from "@/types/work";

type Props = {
  works: Work[];
};

export default function RankingHero({ works }: Props) {
  if (works.length < 3) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-2 text-2xl font-bold">
        🏆 TOP3 注目作品
      </h2>

      <p className="mb-4 text-sm text-gray-500">
        発掘LAB独自スコアで選ばれた、今もっとも注目すべき作品です。
      </p>

      <div className="relative rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-white p-4 shadow-lg">
  <div className="absolute -top-3 left-4 rounded-full bg-yellow-500 px-4 py-1 text-sm font-bold text-white shadow">
    👑 No.1
  </div>

  <WorkCard work={works[0]}  large
  />
</div>

<div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
  <div className="relative">
    <div className="absolute -top-3 left-4 z-10 rounded-full bg-gray-400 px-4 py-1 text-sm font-bold text-white shadow">
      🥈 No.2
    </div>

    <WorkCard work={works[1]} />
  </div>

  <div className="relative">
    <div className="absolute -top-3 left-4 z-10 rounded-full bg-amber-700 px-4 py-1 text-sm font-bold text-white shadow">
      🥉 No.3
    </div>

    <WorkCard work={works[2]} />
  </div>
</div>

    </section>
  );
}