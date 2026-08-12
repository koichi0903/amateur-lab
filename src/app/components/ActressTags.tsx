"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  actress: string;
};

const INITIAL_VISIBLE_COUNT = 5;

export default function ActressTags({ actress }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const actresses = actress
    .split(/\s*\/\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
  const hasHiddenActresses = actresses.length > INITIAL_VISIBLE_COUNT;
  const visibleActresses = isExpanded
    ? actresses
    : actresses.slice(0, INITIAL_VISIBLE_COUNT);

  return (
    <div className="min-w-0 basis-full">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {visibleActresses.map((name, index) => (
          <Link
            key={`${name}-${index}`}
            href={`/actress/${encodeURIComponent(name)}`}
            className="max-w-full break-words rounded-full bg-pink-100 px-4 py-1.5 text-sm font-semibold leading-5 text-pink-700 transition hover:bg-pink-200"
          >
            <span aria-hidden="true">👩 </span>
            {name}
          </Link>
        ))}
      </div>

      {hasHiddenActresses && (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="mt-2 rounded-full border border-pink-200 bg-white px-3 py-1.5 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
        >
          {isExpanded
            ? "5名だけ表示に戻す"
            : `すべての女優を表示（残り${actresses.length - INITIAL_VISIBLE_COUNT}名）`}
        </button>
      )}
    </div>
  );
}
