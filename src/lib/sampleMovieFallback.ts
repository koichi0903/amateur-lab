export type SampleMovieDeliveryMode = "official-vr" | "official-page";

type WorkMediaIdentity = {
  title?: string | null;
  genre?: string | null;
  series?: string | null;
};

const VR_WORK_PATTERN = /(?:^|[^A-Z0-9])(?:8K)?VR(?:$|[^A-Z0-9])/i;

export function isVrWork(work: WorkMediaIdentity): boolean {
  const searchable = [work.title, work.genre, work.series]
    .filter(Boolean)
    .join(" / ");

  return VR_WORK_PATTERN.test(searchable);
}

export function getSampleMovieFallbackCopy(work: WorkMediaIdentity) {
  if (isVrWork(work)) {
    return {
      label: "FANZA公式でサンプル動画を見る",
      note: "VR動画はFANZA公式プレイヤーで再生されます",
      deliveryMode: "official-vr" as const,
    };
  }

  return {
    label: "FANZA公式で作品・サンプルを確認",
    note: "サンプル動画の提供状況は公式ページでご確認ください",
    deliveryMode: "official-page" as const,
  };
}
