"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { HomePricePoint } from "@/lib/getHomePriceInsights";
import { parseDatabaseDate } from "@/lib/dateTime";
import { buildMiniPriceChartGeometry, type MiniPriceChartGeometry, type PositionedMiniPricePoint } from "@/lib/miniPriceChart";

type ChartVariant = "hero" | "main" | "compact";

type Props = {
  points: HomePricePoint[];
  windowStartAt: string;
  windowEndAt: string;
  lowPrice: number;
  currentPrice: number;
  variant?: ChartVariant;
};

const dimensions: Record<ChartVariant, { width: number; height: number; className: string }> = {
  hero: { width: 360, height: 104, className: "h-[104px]" },
  main: { width: 300, height: 92, className: "h-[92px]" },
  compact: { width: 240, height: 76, className: "h-[76px]" },
};

const price = (value: number) => `¥${value.toLocaleString("ja-JP")}`;
const signedPrice = (value: number) =>
  `${value >= 0 ? "+" : "-"}¥${Math.abs(value).toLocaleString("ja-JP")}`;

const pointColor = (point: {
  isCurrent?: boolean;
  priceKind?: "regular" | "sale" | null;
  movement: "down" | "up" | "same";
}) => {
  if (point.isCurrent) return "#db2777";
  if (point.priceKind === "sale") return "#ec4899";
  if (point.movement === "down") return "#059669";
  if (point.movement === "up") return "#d97706";
  return "#64748b";
};

const formatDate = (value: string) => {
  const date = parseDatabaseDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

type ChartSize = (typeof dimensions)[ChartVariant];

function chartDisplayConfig(points: HomePricePoint[], geometry: MiniPriceChartGeometry, variant: ChartVariant) {
  const showDetail = variant !== "compact";
  return {
    historyCount: points.filter((point) => !point.isCurrent).length,
    pointRadius: geometry.points.length > 20 ? 1.8 : geometry.points.length > 10 ? 2.2 : 2.8,
    axisFractions: showDetail ? [0, 1 / 3, 2 / 3, 1] : [0, 1],
    axisLabels: showDetail ? ["90日前", "60日前", "30日前", "今日"] : ["90日前", "今日"],
  };
}

function priceDelta(point: PositionedMiniPricePoint | null, previous: PositionedMiniPricePoint | null) {
  return point && previous ? point.price - previous.price : null;
}

function MiniPriceTooltip({ point, delta, width }: { point: PositionedMiniPricePoint | null; delta: number | null; width: number }) {
  if (!point) return null;
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 min-w-28 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold leading-4 text-slate-700 shadow-lg sm:text-[10px]"
      style={{ left: `${Math.min(82, Math.max(18, (point.x / width) * 100))}%` }}
    >
      <span className="block text-slate-400">{point.isCurrent ? "現在" : formatDate(point.changedAt)}</span>
      <span className="block text-sm font-black text-slate-950">{price(point.price)}</span>
      {delta != null && delta !== 0 && <span className={delta < 0 ? "text-emerald-700" : "text-amber-700"}>前回比 {signedPrice(delta)}</span>}
    </div>
  );
}

function PriceAxisGuides({ fractions, geometry }: { fractions: number[]; geometry: MiniPriceChartGeometry }) {
  return <>{fractions.map((fraction) => {
    const x = geometry.plotLeft + fraction * (geometry.plotRight - geometry.plotLeft);
    return <path key={fraction} d={`M ${x} 6 V ${geometry.plotBottom}`} stroke="#cbd5e1" strokeDasharray="2 5" strokeWidth="0.8" opacity="0.65" />;
  })}</>;
}

function PriceSeries({ geometry, variant }: { geometry: MiniPriceChartGeometry; variant: ChartVariant }) {
  return (
    <>
      <path d={`M ${geometry.plotLeft} ${geometry.lowY} H ${geometry.plotRight}`} stroke="#10b981" strokeDasharray="4 4" strokeWidth="1" opacity="0.75" />
      {geometry.areaPath && <path d={geometry.areaPath} fill="#ec4899" opacity="0.07" />}
      {geometry.stepPath && <path d={geometry.stepPath} fill="none" stroke="#475569" strokeLinecap="round" strokeLinejoin="round" strokeWidth={variant === "hero" ? 3 : 2.5} />}
    </>
  );
}

function PriceChangeSteps({ geometry, variant }: { geometry: MiniPriceChartGeometry; variant: ChartVariant }) {
  return <>{geometry.points.slice(1).map((point, index) => {
    const previous = geometry.points[index];
    if (point.movement === "same") return null;
    return <path key={`change-${point.changedAt}-${index}`} d={`M ${point.x} ${previous.y} V ${point.y}`} stroke={point.movement === "down" ? "#059669" : "#d97706"} strokeWidth={variant === "hero" ? 4 : 3} strokeLinecap="round" />;
  })}</>;
}

function PriceHistoryMarkers({
  points,
  pointRadius,
  setSelectedIndex,
}: {
  points: PositionedMiniPricePoint[];
  pointRadius: number;
  setSelectedIndex: Dispatch<SetStateAction<number | null>>;
}) {
  return <>{points.map((point, index) => {
    const fill = pointColor(point);
    const radius = point.isCurrent ? pointRadius + 2 : pointRadius;
    const previousPrice = points[index - 1]?.price;
    const delta = previousPrice == null ? "" : `、前回比${signedPrice(point.price - previousPrice)}`;
    return (
      <g
        key={`${point.changedAt}-${index}`}
        role="button"
        tabIndex={0}
        aria-label={`${point.isCurrent ? "現在" : formatDate(point.changedAt)} ${price(point.price)}${delta}`}
        onPointerEnter={() => setSelectedIndex(index)}
        onFocus={() => setSelectedIndex(index)}
        onBlur={() => setSelectedIndex(null)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((current) => current === index ? null : index);
        }}
      >
        <circle cx={point.x} cy={point.y} r={Math.max(8, radius + 5)} fill="transparent" />
        <circle cx={point.x} cy={point.y} r={radius} fill={point.isCurrent ? "white" : fill} stroke={fill} strokeWidth={point.isCurrent ? 2.8 : 1.4} />
      </g>
    );
  })}</>;
}

function PriceAxisLabels({
  labels,
  fractions,
  geometry,
  size,
  variant,
}: {
  labels: string[];
  fractions: number[];
  geometry: MiniPriceChartGeometry;
  size: ChartSize;
  variant: ChartVariant;
}) {
  return <>{labels.map((label, index) => {
    const fraction = fractions[index];
    const x = geometry.plotLeft + fraction * (geometry.plotRight - geometry.plotLeft);
    const anchor = index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle";
    return <text key={label} x={x} y={size.height - 3} textAnchor={anchor} fontSize={variant === "compact" ? 8 : 9} fontWeight="700" fill="#94a3b8">{label}</text>;
  })}</>;
}

export default function MiniPriceHistoryChart({
  points,
  windowStartAt,
  windowEndAt,
  lowPrice,
  currentPrice,
  variant = "compact",
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const size = dimensions[variant];
  const geometry = buildMiniPriceChartGeometry({
    points,
    windowStartAt,
    windowEndAt,
    width: size.width,
    height: size.height,
    bottom: variant === "compact" ? 18 : 22,
  });
  const display = chartDisplayConfig(points, geometry, variant);
  const selectedPoint = geometry.points[selectedIndex ?? -1] ?? null;
  const selectedPrevious = geometry.points[(selectedIndex ?? 0) - 1] ?? null;
  const selectedDelta = priceDelta(selectedPoint, selectedPrevious);

  return (
    <div className="relative min-w-0" onPointerLeave={() => setSelectedIndex(null)}>
      <MiniPriceTooltip point={selectedPoint} delta={selectedDelta} width={size.width} />
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        className={`w-full ${size.className}`}
        role="img"
         aria-label={`取得できた最大90日分の価格履歴。履歴${display.historyCount}点、現在価格${price(currentPrice)}`}
      >
        <title>取得できた最大90日分の価格履歴</title>
        <desc>取得できた価格記録のみを実際の日時に合わせて表示しています。</desc>

        <PriceAxisGuides fractions={display.axisFractions} geometry={geometry} />
        <PriceSeries geometry={geometry} variant={variant} />
        <PriceChangeSteps geometry={geometry} variant={variant} />
        <PriceHistoryMarkers points={geometry.points} pointRadius={display.pointRadius} setSelectedIndex={setSelectedIndex} />
        <PriceAxisLabels labels={display.axisLabels} fractions={display.axisFractions} geometry={geometry} size={size} variant={variant} />
      </svg>

      <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] font-bold text-slate-500 sm:text-[10px]">
        <span>履歴 {display.historyCount}点</span>
        <span className="text-emerald-700">記録最安 {price(lowPrice)}</span>
      </div>
    </div>
  );
}
