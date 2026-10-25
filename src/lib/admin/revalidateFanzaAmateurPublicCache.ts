import { revalidatePath, revalidateTag } from "next/cache";

/** Refresh shared amateur catalog caches after the daily catalog write completes. */
export function revalidateFanzaAmateurPublicCache() {
  revalidateTag("fanza-amateur-catalog", { expire: 0 });
  revalidateTag("fanza-amateur-taxonomy", { expire: 0 });
  revalidateTag("fanza-amateur-home", { expire: 0 });

  for (const path of [
    "/amateur",
    "/amateur/search",
    "/amateur/sale",
    "/amateur/personal-pick",
    "/amateur/genre",
    "/amateur/maker",
    "/api/amateur",
  ]) {
    revalidatePath(path);
  }
  revalidatePath("/amateur/[contentId]", "page");
  revalidatePath("/amateur/genre/[name]", "page");
  revalidatePath("/amateur/maker/[name]", "page");
}
