"use client";

import { useState } from "react";
import type { HomePricePoint } from "@/lib/getHomePriceInsights";
import { parseDatabaseDate } from "@/lib/dateTime";
import { buildMiniPriceChartGeometry } from "@/lib/miniPriceChart";

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
  const showDetail = variant !== "compact";
  const geometry = buildMiniPriceChartGeometry({
    points,
    windowStartAt,
    windowEndAt,
    width: size.width,
    height: size.height,
    bottom: showDetail ? 22 : 18,
  });
  const historyCount = points.filter((point) => !point.isCurrent).length;
  const pointRadius = geometry.points.length > 20 ? 1.8 : geometry.points.length > 10 ? 2.2 : 2.8;
  const axisFractions = showDetail ? [0, 1 / 3, 2 / 3, 1] : [0, 1];
  const axisLabels = showDetail ? ["90日前", "60日前", "30日前", "今日"] : ["90日前", "今日"];
  const selectedPoint = selectedIndex == null ? null : geometry.points[selectedIndex];
  const selectedPrevious = selectedIndex == null ? null : geometry.points[selectedIndex - 1];
  const selectedDelta =
    selectedPoint && selectedPrevious ? selectedPoint.price - selectedPrevious.price : null;

  return (
    <div className="relative min-w-0" onPointerLeave={() => setSelectedIndex(null)}>
      {selectedPoint && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-28 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold leading-4 text-slate-700 shadow-lg sm:text-[10px]"
          style={{
            left: `${Math.min(82, Math.max(18, (selectedPoint.x / size.width) * 100))}%`,
          }}
        >
          <span className="block text-slate-400">
            {selectedPoint.isCurrent ? "現在" : formatDate(selectedPoint.changedAt)}
          </span>
          <span className="block text-sm font-black text-slate-950">{price(selectedPoint.price)}</span>
          {selectedDelta != null && selectedDelta !== 0 && (
            <span className={selectedDelta < 0 ? "text-emerald-700" : "text-amber-700"}>
              前回比 {signedPrice(selectedDelta)}
            </span>
          )}
        </div>
      )}
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        className={`w-full ${size.className}`}
        role="img"
        aria-label={`過去90日の価格推移。履歴${historyCount}点、現在価格${price(currentPrice)}`}
      >
        <title>過去90日の価格推移</title>
        <desc>保存されたすべての価格変更点を実際の日時に合わせて表示しています。</desc>

        {axisFractions.map((fraction) => {
          const x = geometry.plotLeft + fraction * (geometry.plotRight - geometry.plotLeft);
          return (
            <path
              key={fraction}
              d={`M ${x} 6 V ${geometry.plotBottom}`}
              stroke="#cbd5e1"
              strokeDasharray="2 5"
              strokeWidth="0.8"
              opacity="0.65"
            />
          );
        })}

        <path
          d={`M ${geometry.plotLeft} ${geometry.lowY} H ${geometry.plotRight}`}
          stroke="#10b981"
          strokeDasharray="4 4"
          strokeWidth="1"
          opacity="0.75"
        />
        {geometry.areaPath && <path d={geometry.areaPath} fill="#ec4899" opacity="0.07" />}
        {geometry.stepPath && (
          <path
            d={geometry.stepPath}
            fill="none"
            stroke="#475569"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={variant === "hero" ? 3 : 2.5}
          />
        )}

        {geometry.points.slice(1).map((point, index) => {
          const previous = geometry.points[index];
          if (point.movement === "same") return null;
          return (
            <path
              key={`change-${point.changedAt}-${index}`}
              d={`M ${point.x} ${previous.y} V ${point.y}`}
              stroke={point.movement === "down" ? "#059669" : "#d97706"}
              strokeWidth={variant === "hero" ? 4 : 3}
              strokeLinecap="round"
            />
          );
        })}

        {geometry.points.map((point, index) => {
          const fill = pointColor(point);
          const radius = point.isCurrent ? pointRadius + 2 : pointRadius;
          const previousPrice = geometry.points[index - 1]?.price;
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
              <circle
                cx={point.x}
                cy={point.y}
                r={Math.max(8, radius + 5)}
                fill="transparent"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={radius}
                fill={point.isCurrent ? "white" : fill}
                stroke={fill}
                strokeWidth={point.isCurrent ? 2.8 : 1.4}
              />
            </g>
          );
        })}

        {axisLabels.map((label, index) => {
          const fraction = axisFractions[index];
          const x = geometry.plotLeft + fraction * (geometry.plotRight - geometry.plotLeft);
          return (
            <text
              key={label}
              x={x}
              y={size.height - 3}
              textAnchor={index === 0 ? "start" : index === axisLabels.length - 1 ? "end" : "middle"}
              fontSize={variant === "compact" ? 8 : 9}
              fontWeight="700"
              fill="#94a3b8"
            >
              {label}
            </text>
          );
        })}
      </svg>

      <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] font-bold text-slate-500 sm:text-[10px]">
        <span>履歴 {historyCount}点</span>
        <span className="text-emerald-700">90日最安 {price(lowPrice)}</span>
      </div>
    </div>
  );
}
