"use client";

import { useEffect, useState } from "react";
import { FAVORITES_CHANGED_EVENT, readFavoriteIds, toggleFavorite } from "@/lib/favorites";

type Props = { workId: number; addLabel?: string; className?: string };

export default function FavoriteButton({ workId, addLabel = "お気に入り", className = "" }: Props) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const sync = () => setIsFavorite(readFavoriteIds().includes(workId));
    sync();
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [workId]);

  return (
    <button type="button" aria-pressed={isFavorite} aria-label={isFavorite ? "お気に入りから解除" : "お気に入りに追加"} onClick={() => toggleFavorite(workId)} className={className}>
      {isFavorite ? "♥ お気に入り済み" : `♡ ${addLabel}`}
    </button>
  );
}
