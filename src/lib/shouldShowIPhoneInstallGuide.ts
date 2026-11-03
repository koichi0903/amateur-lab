export function shouldShowIPhoneInstallGuide(
  userAgent: string,
  appleStandalone: boolean,
  displayModeStandalone: boolean,
) {
  return /iPhone/i.test(userAgent) && !appleStandalone && !displayModeStandalone;
}
