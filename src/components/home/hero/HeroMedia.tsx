"use client";

import { useEffect, useRef, useState } from "react";
import WorkImage from "../WorkImage";

export default function HeroMedia({
  imageUrl,
  videoUrl,
  title,
}: {
  imageUrl: string | null;
  videoUrl: string | null;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(!videoUrl);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [failed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed || !ready) return;
    if (!visible) {
      video.pause();
      return;
    }
    void video.play().catch(() => setFailed(true));
  }, [failed, ready, visible]);

  const showVideo = Boolean(videoUrl) && !failed;

  return (
    <>
      {imageUrl ? (
        <WorkImage
          src={imageUrl}
          alt={title}
          priority
          className={`object-cover object-top transition-opacity duration-300 ${showVideo && ready ? "opacity-0" : "opacity-80"}`}
          sizes="(max-width: 1024px) 100vw, 680px"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm font-bold text-white/55">AI発掘作品を準備中</div>
      )}
      {showVideo && (
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          poster={imageUrl ?? undefined}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ${ready ? "opacity-80" : "opacity-0"}`}
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}
