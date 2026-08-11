import { updateRanking } from "@/lib/admin/updateRanking";

async function main() {
  await updateRanking();
}

main().catch(console.error);