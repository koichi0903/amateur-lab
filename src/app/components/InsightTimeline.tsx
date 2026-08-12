type Insight = {
  id: number;
  title: string;
  description: string | null;
};

type Props = {
  insights: Insight[];
};

const colors = [
  "bg-green-50 border-green-200",
  "bg-pink-50 border-pink-200",
  "bg-blue-50 border-blue-200",
  "bg-orange-50 border-orange-200",
  "bg-violet-50 border-violet-200",
];

const icons = [
  "💚",
  "🔥",
  "⭐",
  "📈",
  "🕒",
];

export default function InsightTimeline({
  insights,
}: Props) {
  if (insights.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">

      <div className="mb-5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">

        <h2 className="text-xl font-black sm:text-2xl">
          💡 今日のインサイト
        </h2>

        <span className="text-sm font-semibold text-pink-600">
          もっと見る →
        </span>

      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4">

        {insights.slice(0, 4).map((item, index) => (

          <div
  key={item.id}
  className={`
    w-[82%] min-w-[82%] snap-start rounded-2xl border p-4 transition sm:w-[72%] sm:min-w-[72%] md:w-auto md:min-w-0 md:p-5
    hover:-translate-y-1 hover:shadow-md
    ${colors[index % colors.length]}
  `}
>

  <div className="text-2xl">
    {icons[index % icons.length]}
  </div>

  <h3 className="mt-3 text-base font-black">
    {item.title}
  </h3>

  <p className="mt-3 text-sm leading-6 text-zinc-600">
    {item.description ?? "最新情報を分析しています。"}
  </p>

</div>

        ))}

      </div>

    </section>
  );
}
