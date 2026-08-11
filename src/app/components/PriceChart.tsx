"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type PricePoint = {
  date: string;
  price: number;
};

type Props = {
  data: PricePoint[];
};

export default function PriceChart({
  data,
}: Props) {
  return (
    <div className="mt-6 h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid
  stroke="#d4d4d8"
  strokeDasharray="4 4"
/>

          <XAxis
  dataKey="date"
  interval="preserveStartEnd"
  minTickGap={40}
/>

          <YAxis
  domain={["dataMin - 100", "dataMax + 100"]}
  tickFormatter={(v) => `¥${Number(v).toLocaleString()}`}
/>

          <Tooltip
  labelFormatter={(label) => `更新日時: ${label}`}
  formatter={(value) => [
    `¥${Number(value).toLocaleString()}`,
    "価格",
  ]}
/>

          <Line
  type="stepAfter"
  dataKey="price"
  stroke="#ec4899"
  strokeWidth={4}
  strokeLinecap="round"
  strokeLinejoin="round"
  dot={(props) => {
    const isLast =
      props.index === data.length - 1;

    return (
      <circle
        cx={props.cx}
        cy={props.cy}
        r={isLast ? 8 : 5}
        fill="#ec4899"
        stroke="white"
        strokeWidth={2}
      />
    );
  }}
  activeDot={{
    r: 10,
    stroke: "#ec4899",
    strokeWidth: 2,
    fill: "#fff",
  }}
/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}