import Link from "next/link";

type Item = {
  name: string;
  count: number;
};

type Props = {
  title: string;
  icon: string;
  items: Item[];
  href: string;
  color?: "blue" | "green" | "purple";
};

export default function TopRankingCard({
  title,
  icon,
  items,
  href,
  color = "blue",
}: Props) {
  const colors = {
    blue: {
      card: "bg-blue-50 border-blue-200",
      text: "text-blue-600",
      button: "bg-blue-600 hover:bg-blue-700",
    },
    green: {
      card: "bg-green-50 border-green-200",
      text: "text-green-600",
      button: "bg-green-600 hover:bg-green-700",
    },
    purple: {
      card: "bg-purple-50 border-purple-200",
      text: "text-purple-600",
      button: "bg-purple-600 hover:bg-purple-700",
    },
  };

  const style = colors[color];

  return (
    <div
  className={`min-h-[190px] rounded-xl border p-6 ${style.card}`}
>
      <h2 className="text-2xl font-bold mb-4">
        {icon} {title}
      </h2>

      {items.slice(0, 3).map((item, index) => (
        <div
          key={item.name}
          className="flex justify-between py-3 border-b"
        >
          <Link
            href={`${href}/${encodeURIComponent(item.name)}`}
            className={`font-bold hover:underline ${style.text}`}
          >
            {index === 0 && "🥇 "}
            {index === 1 && "🥈 "}
            {index === 2 && "🥉 "}
            {item.name}
          </Link>

          <span className="font-bold">
            {item.count}件
          </span>
        </div>
      ))}

      <Link
        href={href}
        className={`mt-4 block rounded-lg py-2 text-center text-white font-bold ${style.button}`}
      >
        もっと見る →
      </Link>
    </div>
  );
}