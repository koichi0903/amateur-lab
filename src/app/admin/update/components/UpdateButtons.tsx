type UpdateButtonsProps = {
  onUpdateAll?: () => void;
  onUpdateNew?: () => void;
  onUpdateSemiNew?: () => void;
  onUpdateSale?: () => void;
  loading?: boolean;
};

export default function UpdateButtons({
  onUpdateAll,
  onUpdateNew,
  onUpdateSemiNew,
  onUpdateSale,
  loading = false,
}: UpdateButtonsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <button
        onClick={onUpdateAll}
        disabled={loading}
        className="rounded-xl bg-purple-600 px-6 py-4 font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        🚀 全更新
      </button>

      <button
        onClick={onUpdateNew}
        disabled={loading}
        className="rounded-xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        🆕 新作更新
      </button>

      <button
        onClick={onUpdateSemiNew}
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-6 py-4 font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ⭐ 準新作更新
      </button>

      <button
        onClick={onUpdateSale}
        disabled={loading}
        className="rounded-xl bg-amber-600 px-6 py-4 font-bold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        💰 セール更新
      </button>
    </div>
  );
}