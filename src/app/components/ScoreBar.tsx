type Props = {
  value: number;
  max: number;
};

export default function ScoreBar({
  value,
  max,
}: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600"
          style={{
            width: `${Math.min((value / max) * 100, 100)}%`,
          }}
        />
      </div>

      <span className="w-16 text-right font-bold text-sm">
        {value} / {max}
      </span>
    </div>
  );
}