import { updateLongHitRanking } from "../src/lib/playwright/updateLongHitRanking";

updateLongHitRanking().catch((error) => {
  console.error(error);
  process.exit(1);
});