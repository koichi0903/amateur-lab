type Props = {
  label: string;
  value: number;
  max: number;
};

export default function MiniBar({
  label,
  value,
  max,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[11px] text-gray-600 font-medium">
        {label}
      </span>

      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600"
          style={{
            width: `${Math.min((value / max) * 100, 100)}%`,
          }}
        />
      </div>

      <span className="w-5 text-right text-[11px] font-bold text-gray-700">
        {value}
      </span>
    </div>
  );
}