"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function useOfficialSampleEmbedSize(officialSampleEmbedUrl: string | null | undefined) {
  const officialPlayerRef = useRef<HTMLDivElement>(null);
  const [officialPlayerSize, setOfficialPlayerSize] = useState({ width: 260, height: 167 });
  const compactOfficialSampleEmbedUrl = officialSampleEmbedUrl
    ?.replace(/width=\d+/, `width=${officialPlayerSize.width}`)
    .replace(/height=\d+/, `height=${officialPlayerSize.height}`);

  useLayoutEffect(() => {
    const player = officialPlayerRef.current;
    if (!player || !officialSampleEmbedUrl) return;

    const updatePlayerSize = () => {
      const width = Math.max(260, Math.round(player.getBoundingClientRect().width));
      const height = Math.round((width * 167) / 260);
      setOfficialPlayerSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };

    updatePlayerSize();
    const observer = new ResizeObserver(updatePlayerSize);
    observer.observe(player);
    return () => observer.disconnect();
  }, [officialSampleEmbedUrl]);

  return { officialPlayerRef, compactOfficialSampleEmbedUrl };
}
