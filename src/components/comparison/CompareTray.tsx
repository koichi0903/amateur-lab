"use client";

import Link from "next/link";
import { Scale, Trash2 } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  clearComparison,
  MAX_COMPARISON_ITEMS,
  readComparisonIds,
  subscribeComparison,
} from "@/lib/comparison";

export default function CompareTray() {
  const count = useSyncExternalStore(
    subscribeComparison,
    () => readComparisonIds().length,
    () => 0,
  );

  if (!count) return null;

  return (
    <aside aria-label="作品比較" className="fixed bottom-20 right-3 z-[60] flex items-center gap-2 rounded-2xl border border-pink-200 bg-white p-2 shadow-2xl md:bottom-5 md:right-5">
      <Link href="/compare" className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white transition hover:bg-pink-600">
        <Scale size={16} aria-hidden="true" />
        {count}作品を比較
        <span className="text-white/60">/{MAX_COMPARISON_ITEMS}</span>
      </Link>
      <button type="button" onClick={clearComparison} aria-label="比較リストを空にする" className="rounded-xl p-3 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600">
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </aside>
  );
}
