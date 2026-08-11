import BaseCard from "@/components/ui/BaseCard";

type InsightCardProps = {
  type?: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  onClick?: () => void;
};

export default function InsightCard({
  type,
  icon,
  title,
  description,
  badge,
  onClick,
}: InsightCardProps) {

  const style =
  type === "PRICE_DROP"
    ? {
        iconBg: "bg-red-500/10",
        badgeBg: "bg-red-500/10",
        badgeText: "text-red-400",
        hover: "group-hover:text-red-400",
      }
    : type === "LOWEST_PRICE"
    ? {
        iconBg: "bg-emerald-500/10",
        badgeBg: "bg-emerald-500/10",
        badgeText: "text-emerald-400",
        hover: "group-hover:text-emerald-400",
      }
    : {
        iconBg: "bg-blue-500/10",
        badgeBg: "bg-blue-500/10",
        badgeText: "text-blue-400",
        hover: "group-hover:text-blue-400",
      };

  return (
    <BaseCard
      onClick={onClick}
      className="group h-full transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl">
          {icon}
        </div>

        <div className="flex-1">
          {badge && (
            <span className="mb-2 inline-block rounded-full bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400">
              {badge}
            </span>
          )}

          <h3 className="text-lg font-bold text-white transition-colors group-hover:text-blue-400">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {description}
          </p>
        </div>
      </div>
    </BaseCard>
  );
}