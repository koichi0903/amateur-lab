import { updateRanking } from "../src/lib/playwright/updateRanking";

updateRanking().catch((error) => {
  console.error(error);
  process.exit(1);
});