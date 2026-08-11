type Props = {
  value: number;
  max: number;
};

export default function ScoreBar({
  value,
  max,
}: Props) {
  const percent =
    max > 0
      ? Math.min((value / max) * 100, 100)
      : 0;

  return (
    <div className="w-full">

      <div className="h-3 overflow-hidden rounded-full bg-zinc-200">

        <div
          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 transition-all duration-500"
          style={{
            width: `${percent}%`,
          }}
        />

      </div>

    </div>
  );
}