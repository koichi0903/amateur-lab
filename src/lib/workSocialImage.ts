import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/seo";

type SocialWork = {
  image_url: string | null;
};

const IMAGE_CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

function fallbackImage() {
  return Response.redirect(`${SITE_URL}/ogp.png`, 302);
}

export async function createWorkSocialImageResponse(id: string) {
  const { data: work } = await supabase
    .from("works")
    .select("image_url")
    .eq("id", id)
    .single<SocialWork>();

  if (!work?.image_url) return fallbackImage();

  try {
    const imageResponse = await fetch(work.image_url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HakkutsuLAB/1.0)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      next: { revalidate: 86400 },
    });

    if (!imageResponse.ok || !imageResponse.body) return fallbackImage();

    const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";

    return new Response(imageResponse.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": IMAGE_CACHE_CONTROL,
      },
    });
  } catch {
    return fallbackImage();
  }
}
