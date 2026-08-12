import InsightCard from "./InsightCard";

type Insight = {
  id: string | number;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  works?: Record<string, unknown> | Record<string, unknown>[] | null;
};

export default function InsightFeed({ insights }: { insights: Insight[] }) {
  return (
    <section id="daily-discovery" className="mx-auto mt-14 max-w-[1500px] scroll-mt-28 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-pink-700">毎日10:00更新</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">🔥 今日のAI発掘</h2>
        </div>
        <span className="hidden text-xs font-bold text-slate-400 sm:block">AIが価格・評価・人気推移を分析</span>
      </div>

      {insights.length ? (
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          本日のAI発掘を準備しています。
        </div>
      )}
    </section>
  );
}
