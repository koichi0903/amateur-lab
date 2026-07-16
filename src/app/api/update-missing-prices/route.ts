import { updateMissingPrices } from "@/lib/admin/updateMissingPrices";

export async function POST() {
  await updateMissingPrices();

  return Response.json({
    success: true,
    message: "価格補完完了",
  });
}