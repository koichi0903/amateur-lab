import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowIPhoneInstallGuide } from "./shouldShowIPhoneInstallGuide";

test("shows the install guide only for a non-standalone iPhone browser", () => {
  assert.equal(shouldShowIPhoneInstallGuide("Mozilla/5.0 (iPhone)", false, false), true);
  assert.equal(shouldShowIPhoneInstallGuide("Mozilla/5.0 (iPhone)", true, false), false);
  assert.equal(shouldShowIPhoneInstallGuide("Mozilla/5.0 (iPhone)", false, true), false);
  assert.equal(shouldShowIPhoneInstallGuide("Mozilla/5.0 (Android)", false, false), false);
});
