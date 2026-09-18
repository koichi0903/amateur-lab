import { runBijyoReservedSlot } from "@/lib/bijyoReservedAutoPost";

const slot = Number(process.argv[2]);
if (!Number.isSafeInteger(slot) || slot < 0 || slot > 3) throw new Error("slot must be 0..3");
const result = await runBijyoReservedSlot(slot);
console.log(JSON.stringify(result));
if (!result.ok && !("skipped" in result && result.skipped)) process.exitCode = 1;
