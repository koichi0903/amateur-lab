import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

const SOCIAL_IMAGE_WIDTH = 1200;
const SOCIAL_IMAGE_HEIGHT = 630;

type SocialWork = {
  image_url: string | null;
};

async function imageDataUrl(imageUrl: string | null) {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HakkutsuLAB/1.0)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function createWorkSocialImage(id: string) {
  const { data: work } = await supabase
    .from("works")
    .select("image_url")
    .eq("id", id)
    .single<SocialWork>();

  const imageSrc = await imageDataUrl(work?.image_url ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f3f4f6",
              color: "#111827",
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            Hakkutsu LAB
          </div>
        )}
      </div>
    ),
    {
      width: SOCIAL_IMAGE_WIDTH,
      height: SOCIAL_IMAGE_HEIGHT,
    },
  );
}
