import { permanentRedirect } from "next/navigation";

export default function LegacyMyfansXGrowthRedirect() {
  permanentRedirect("/admin/myfans?media=1");
}
