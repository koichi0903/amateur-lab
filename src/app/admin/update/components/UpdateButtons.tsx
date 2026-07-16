type UpdateButtonsProps = {
  onSyncWorks?: () => void;

  onUpdateStage?: () => void;

  onUpdateNew?: () => void;

  onUpdateSemiNew?: () => void;

  onUpdateOld?: () => void;

  onUpdateSale?: () => void;

  onUpdateEndedSale?: () => void;

  onUpdateAll?: () => void;

  onUpdateRanking?: () => void;

  onUpdateScore?: () => void;

  onUpdateMissingPrices?: () => void;

  onUpdateReserve?: () => void;

  isUpdating?: boolean;
};

export default function UpdateButtons({
  onSyncWorks,

  onUpdateStage,

  onUpdateNew,

  onUpdateSemiNew,

  onUpdateOld,

  onUpdateSale,

  onUpdateEndedSale,

  onUpdateAll,

  onUpdateRanking,

  onUpdateScore,

  onUpdateMissingPrices,

  onUpdateReserve,

isUpdating = false,
}: UpdateButtonsProps)
{

  const buttons = [
  {
    label: "📥 作品同期",
    onClick: onSyncWorks,
    color: "bg-blue-600 hover:bg-blue-500",
  },
  {
    label: "🏷 Stage同期",
    onClick: onUpdateStage,
    color: "bg-emerald-600 hover:bg-emerald-500",
  },
  {
    label: "🆕 新作更新",
    onClick: onUpdateNew,
    color: "bg-cyan-600 hover:bg-cyan-500",
  },
  {
    label: "⭐ 準新作更新",
    onClick: onUpdateSemiNew,
    color: "bg-indigo-600 hover:bg-indigo-500",
  },
  {
    label: "📦 旧作更新",
    onClick: onUpdateOld,
    color: "bg-orange-600 hover:bg-orange-500",
  },
  {
    label: "🔚 終了セール更新",
    onClick: onUpdateEndedSale,
    color: "bg-rose-600 hover:bg-rose-500",
  },
  {
    label: "🚀 全更新",
    onClick: onUpdateAll,
    color: "bg-purple-600 hover:bg-purple-500",
  },
    {
    label: "💰 セール更新",
    onClick: onUpdateSale,
    color: "bg-amber-600 hover:bg-amber-500",
  },
  {
    label: "🏆 ランキング更新",
    onClick: onUpdateRanking,
    color: "bg-sky-600 hover:bg-sky-500",
  },
  {
  label: "🧮 スコア更新",
  onClick: onUpdateScore,
  color: "bg-teal-600 hover:bg-teal-500",
},
  {
  label: "💵 価格補完",
  onClick: onUpdateMissingPrices,
  color: "bg-lime-600 hover:bg-lime-500",
},
  {
  label: "📅 予約作品更新",
  onClick: onUpdateReserve,
  color: "bg-pink-600 hover:bg-pink-500",
},

];

  return (
    <div className="grid gap-4 md:grid-cols-2">
  {buttons.map((button) => (
  <button
    key={button.label}
    onClick={button.onClick}
    disabled={isUpdating}
    className={`
      rounded-xl
      h-16
      font-bold
      text-white
      transition
      disabled:cursor-not-allowed
      disabled:opacity-50
      ${button.color}
    `}
  >
    {isUpdating &&
    button.label === "📥 作品同期"
      ? "⏳ 同期中..."
      : button.label}
  </button>
))}
    </div>
  );
}