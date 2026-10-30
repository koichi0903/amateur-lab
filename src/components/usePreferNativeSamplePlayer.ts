"use client";

import { useEffect, useState } from "react";

export function usePreferNativeSamplePlayer() {
  const [preferNativeSamplePlayer, setPreferNativeSamplePlayer] = useState(false);

  useEffect(() => {
    const updatePreference = () => {
      setPreferNativeSamplePlayer(
        window.matchMedia("(pointer: coarse)").matches ||
          window.matchMedia("(max-width: 767px)").matches ||
          navigator.maxTouchPoints > 0,
      );
    };

    updatePreference();
    window.addEventListener("resize", updatePreference);
    return () => window.removeEventListener("resize", updatePreference);
  }, []);

  return preferNativeSamplePlayer;
}
