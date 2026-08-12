"use client";

import Image from "next/image";
import { useState } from "react";

export default function WorkImage({
  src,
  alt,
  sizes,
  priority = false,
  className = "object-cover",
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  unoptimized?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-3 text-center text-[11px] font-black tracking-widest text-slate-400">
        NO IMAGE
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
