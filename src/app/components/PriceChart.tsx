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
          <CartesianGrid strokeDasharray="3 3" />

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
  strokeWidth={3}
  dot={{ r: 6 }}
  activeDot={{ r: 8 }}
/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}