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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {insights.slice(0, 4).map((item, index) => (

          <div
  key={item.id}
  className={`
    rounded-2xl border p-5 transition
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
