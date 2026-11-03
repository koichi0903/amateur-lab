export type FanzaAmateurMp4AttemptCompletion = {
  update: {
    mp4_url: string | null;
    mp4_status: "found" | "no_video" | "pending";
    mp4_checked_at: string;
    mp4_last_error: string | null;
  };
  kind: "found" | "no_video" | "failed";
};

export function projectFanzaAmateurMp4AttemptCompletion({
  movieUrl,
  failure,
  attemptCount,
  checkedAt,
}: {
  movieUrl: string | null;
  failure: string | null;
  attemptCount: number;
  checkedAt: string;
}): FanzaAmateurMp4AttemptCompletion {
  const found = Boolean(movieUrl);
  const terminal = !found && attemptCount >= 3;

  return {
    update: {
      mp4_url: movieUrl,
      mp4_status: found ? "found" : terminal ? "no_video" : "pending",
      mp4_checked_at: checkedAt,
      mp4_last_error: found
        ? null
        : terminal
          ? "3回の取得試行でMP4リンクを確認できませんでした。"
          : failure,
    },
    kind: found ? "found" : terminal ? "no_video" : "failed",
  };
}
