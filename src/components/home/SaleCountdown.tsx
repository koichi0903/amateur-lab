"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { parseDatabaseDate } from "@/lib/dateTime";

const MINUTE_MS = 60 * 1000;

function remainingLabel(saleEndAt: string, now: number) {
  const saleEndTime = parseDatabaseDate(saleEndAt)?.getTime() ?? Number.NaN;
  const remaining = saleEndTime - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;

  const totalMinutes = Math.ceil(remaining / MINUTE_MS);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `終了まで ${days}日${hours}時間`;
  if (hours > 0) return `終了まで ${hours}時間${minutes}分`;
  return `終了まで ${minutes}分`;
}

export default function SaleCountdown({ saleEndAt }: { saleEndAt: string | null }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!saleEndAt) return;

    const update = () => setLabel(remainingLabel(saleEndAt, Date.now()));
    update();
    const timer = window.setInterval(update, MINUTE_MS);

    return () => window.clearInterval(timer);
  }, [saleEndAt]);

  if (!label) return null;

  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-[10px] font-black text-amber-700 sm:text-[11px]">
      <Clock3 aria-hidden="true" size={12} />
      {label}
    </span>
  );
}
