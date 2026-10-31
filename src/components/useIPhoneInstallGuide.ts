"use client";

import { useEffect, useState } from "react";
import { shouldShowIPhoneInstallGuide } from "@/lib/shouldShowIPhoneInstallGuide";

export function useIPhoneInstallGuide() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const safariStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setShow(shouldShowIPhoneInstallGuide(window.navigator.userAgent, safariStandalone, displayModeStandalone));
  }, []);

  return show;
}
