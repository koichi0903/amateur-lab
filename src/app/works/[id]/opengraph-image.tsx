/* eslint-disable @next/next/no-img-element */

import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/seo";

export const alt = "発掘LAB 作品分析";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

/**
 * Product package images supplied by FANZA must not be composited, blurred,
 * cropped, decorated, or otherwise republished as an original social card.
 * Work pages therefore share the site's own, non-explicit OGP artwork.
 */
export default function WorkOpenGraphImage() {
  return new ImageResponse(
    (
      <img
        src={`${SITE_URL}/ogp.png`}
        alt=""
        width={size.width}
        height={size.height}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    ),
    size
  );
}
