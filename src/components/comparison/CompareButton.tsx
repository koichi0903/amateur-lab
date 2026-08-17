"use client";

import { useState, useSyncExternalStore } from "react";
import { Scale } from "lucide-react";
import {
  MAX_COMPARISON_ITEMS,
  readComparisonIds,
  subscribeComparison,
  toggleComparison,
} from "@/lib/comparison";

export default function CompareButton({
  workId,
  className = "",
  compact = false,
}: {
  workId: number;
  className?: string;
  compact?: boolean;
}) {
  const selected = useSyncExternalStore(
    subscribeComparison,
    () => readComparisonIds().includes(workId),
    () => false,
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = () => {
    const result = toggleComparison(workId);
    if (result.full) {
      setMessage(`比較できるのは最大${MAX_COMPARISON_ITEMS}作品です`);
      window.setTimeout(() => setMessage(null), 2500);
    } else {
      setMessage(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={selected}
        onClick={handleClick}
        className={className}
      >
        <Scale size={compact ? 13 : 16} aria-hidden="true" />
        {selected ? "比較中" : compact ? "比較" : "比較リストに追加"}
      </button>
      {message && (
        <p role="status" className="absolute bottom-full right-0 z-20 mb-2 w-56 rounded-xl bg-slate-950 px-3 py-2 text-center text-xs font-bold text-white shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}
