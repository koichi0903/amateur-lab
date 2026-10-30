"use client";

import { useEffect, useState } from "react";
import { AMATEUR_FAVORITES_CHANGED_EVENT, readAmateurFavoriteIds, toggleAmateurFavorite } from "@/lib/amateurFavorites";

type Props = { contentId: string; className?: string; iconOnly?: boolean };

export default function AmateurFavoriteButton({ contentId, className = "", iconOnly = false }: Props) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const sync = () => setIsFavorite(readAmateurFavoriteIds().includes(contentId));
    sync();
    window.addEventListener(AMATEUR_FAVORITES_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AMATEUR_FAVORITES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [contentId]);

  return <button type="button" aria-pressed={isFavorite} aria-label={isFavorite ? "お気に入りから解除" : "お気に入りに追加"} onClick={() => toggleAmateurFavorite(contentId)} className={className}>{iconOnly ? (isFavorite ? "♥" : "♡") : (isFavorite ? "♥ お気に入り済み" : "♡ お気に入り")}</button>;
}
