type UpdateButtonsProps = {
  onSyncWorks?: () => void;
  onUpdateStage?: () => void;
  onUpdateAll?: () => void;
  onUpdateSale?: () => void;

  isUpdating?: boolean;
};

export default function UpdateButtons({
  onSyncWorks,
  onUpdateStage,
  onUpdateAll,
  onUpdateSale,
  isUpdating = false,
}: UpdateButtonsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <button
        onClick={onSyncWorks}
        disabled={isUpdating}
        className="
rounded-xl
h-16
bg-blue-600
font-bold
text-white
transition
hover:bg-blue-500
disabled:cursor-not-allowed
disabled:opacity-50
"
      >
        {isUpdating
          ? "⏳ 同期中..."
          : "🔄 作品同期"}
      </button>

      <button
  onClick={onUpdateStage}
  disabled={false}
  className="
rounded-xl
h-16
bg-emerald-600
font-bold
text-white
transition
hover:bg-emerald-500
"
>
  🏷 Stage同期
</button>

      <button
        onClick={onUpdateAll}
        disabled={false}
        className="
rounded-xl
h-16
bg-purple-600
font-bold
text-white
transition
hover:bg-purple-500
disabled:cursor-not-allowed
disabled:opacity-50
"
      >
        🚀 全更新
      </button>

      <button
        onClick={onUpdateSale}
        disabled={false}
        className="
rounded-xl
h-16
bg-amber-600
font-bold
text-white
transition
hover:bg-amber-500
disabled:cursor-not-allowed
disabled:opacity-50
"
      >
        💰 セール更新
      </button>
    </div>
  );
}