"use client";

type Props = {
  quality: number;
  trust: number;
  discovery: number;
  timing: number;
  decision: number;
};

export default function RadarChart({
  quality,
  trust,
  discovery,
  timing,
  decision,
}: Props) {

  const values = [
    quality,
    trust,
    discovery,
    timing,
    decision,
  ];

  const labels = [
    "⭐ 品質",
    "💬 信頼",
    "🔎 発掘余地",
    "💸 今見る理由",
    "🎬 判断材料",
  ];

  const maxValues = [43, 12, 25, 15, 5];

const size = 360;
const center = size / 2;
const radius = 105;

const getPoint = (
  value: number,
  max: number,
 index: number,
  scale = 1
) => {
  const angle =
    (Math.PI * 2 * index) / labels.length -
    Math.PI / 2;

  const r =
    (value / max) *
    radius *
    scale;

  return {
    x: center + Math.cos(angle) * r,
    y: center + Math.sin(angle) * r,
  };
};

const framePoints = labels
  .map((_, index) => {
    const p = getPoint(
      maxValues[index],
      maxValues[index],
      index
    );
    return `${p.x},${p.y}`;
  })
  .join(" ");

const points = values
  .map((value, index) => {
    const p = getPoint(
      value,
      maxValues[index],
      index
    );
    return `${p.x},${p.y}`;
  })
  .join(" ");

  return (
    <div className="flex w-full min-w-0 justify-center">

      <svg
  className="h-auto w-full max-w-[360px]"
  viewBox="0 0 360 360"
  role="img"
  aria-label="発掘LAB評価の5項目レーダーチャート"
>

       {[0.2, 0.4, 0.6, 0.8, 1].map((scale, index) => {

  const polygon = labels
    .map((_, i) => {

      const p = getPoint(
        maxValues[i],
        maxValues[i],
        i,
        scale
      );

      return `${p.x},${p.y}`;

    })
    .join(" ");

  return (
    <polygon
  key={scale}
  points={polygon}
  fill="none"
  stroke={index === 4 ? "#cbd5e1" : "#dbe4ee"}
  strokeWidth={
    index === 4
      ? 2
      : index === 3
      ? 1.4
      : index === 2
      ? 1.2
      : 1
  }
/>
  );

})}

{labels.map((_, index) => {

  const p = getPoint(
    maxValues[index],
    maxValues[index],
    index
  );

  return (
    <line
      key={index}
      x1={center}
      y1={center}
      x2={p.x}
      y2={p.y}
      stroke="#dbe4ee"
    />
  );

})}

        <polygon
  points={framePoints}
  fill="none"
  stroke="#d4d4d8"
  strokeWidth="2"
/>

        <polygon
  points={points}
  fill="rgba(236,72,153,.32)"
  stroke="#ec4899"
  strokeWidth="3"
/>

        {values.map((value, index) => {

  const p = getPoint(
    value,
    maxValues[index],
    index
  );

  return (
    <circle
      key={index}
      cx={p.x}
      cy={p.y}
      r="3.5"
      fill="#ec4899"
      stroke="white"
      strokeWidth="1.5"
    />
  );

})}

<circle
  cx={center}
  cy={center}
  r="3"
  fill="#94a3b8"
/>

        {labels.map((label, index) => {

          const angle =
            ((Math.PI * 2) / labels.length) *
              index -
            Math.PI / 2;

          const x =
  center +
  Math.cos(angle) * 145;

const y =
  center +
  Math.sin(angle) * 145;

          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="13"
fontWeight="700"
              fill="#52525b"
            >
              {label}
            </text>
          );

        })}

      </svg>

    </div>
  );
}
