import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";

const SOCIAL_IMAGE_WIDTH = 1200;
const SOCIAL_IMAGE_HEIGHT = 630;

type SocialWork = {
  title: string;
  actress: string | null;
  maker: string | null;
  score: number | null;
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

function scoreLabel(score: number | null) {
  return typeof score === "number" && score > 0 ? `Score ${score}` : "Hakkutsu LAB";
}

export async function createWorkSocialImage(id: string) {
  const { data: work } = await supabase
    .from("works")
    .select("title,actress,maker,score,image_url")
    .eq("id", id)
    .single<SocialWork>();

  const title = work?.title ?? "Hakkutsu LAB";
  const subtitle = [work?.actress, work?.maker].filter(Boolean).join(" / ");
  const imageSrc = await imageDataUrl(work?.image_url ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#111827",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 430,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            padding: 34,
          }}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
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
                fontSize: 42,
                fontWeight: 800,
              }}
            >
              Hakkutsu LAB
            </div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "58px 64px",
            background: "linear-gradient(135deg, #111827 0%, #4c0519 58%, #7f1d1d 100%)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                borderRadius: 999,
                background: "#f43f5e",
                padding: "12px 22px",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              {scoreLabel(work?.score ?? null)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 58,
                lineHeight: 1.18,
                fontWeight: 900,
                letterSpacing: 0,
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div
                style={{
                  display: "flex",
                  color: "#fecdd3",
                  fontSize: 30,
                  lineHeight: 1.35,
                  fontWeight: 700,
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#ffe4e6",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            <span>Hakkutsu LAB</span>
            <span>FANZA work review</span>
          </div>
        </div>
      </div>
    ),
    {
      width: SOCIAL_IMAGE_WIDTH,
      height: SOCIAL_IMAGE_HEIGHT,
    },
  );
}
