/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/seo";

export const alt = "発掘LAB 作品情報";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkOpenGraphImage({ params }: Props) {
  const { id } = await params;
  const { data: work } = await supabase
    .from("works")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const imageUrl = work?.image_url || `${SITE_URL}/ogp.png`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          backgroundColor: "#0f172a",
        }}
      >
        <img
          src={imageUrl}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.38,
            filter: "blur(18px)",
            transform: "scale(1.08)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.18) 32%, rgba(15,23,42,0.18) 68%, rgba(15,23,42,0.92) 100%)",
          }}
        />

        <img
          src={imageUrl}
          alt=""
          width={920}
          height={570}
          style={{
            position: "relative",
            width: "auto",
            maxWidth: "920px",
            height: "570px",
            objectFit: "contain",
            borderRadius: "24px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "42px",
            top: "36px",
            display: "flex",
            alignItems: "center",
            padding: "14px 22px",
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: "999px",
            backgroundColor: "rgba(15,23,42,0.82)",
            color: "white",
            fontSize: "25px",
            fontWeight: 800,
            letterSpacing: "0.06em",
          }}
        >
          HAKKUTSU <span style={{ marginLeft: "8px", color: "#ec4899" }}>LAB</span>
        </div>
      </div>
    ),
    size
  );
}
