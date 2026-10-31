import type { XMediaAsset } from "./xMediaAssets";

export type VideoAnalysisAsset = Pick<
  Partial<XMediaAsset>,
  | "work_id"
  | "source_url"
  | "media_type"
  | "video_analysis_version"
  | "video_analysis_source_fingerprint"
  | "visual_video_facts"
>;

export type VideoAnalysisAction = "skip" | "reuse" | "analyze";

export function classifyVideoAnalysisAsset(
  asset: VideoAnalysisAsset,
  expectedVersion: string,
  currentSourceFingerprint: string | null,
): VideoAnalysisAction {
  if (!asset.work_id || !asset.source_url || (asset.media_type !== "video" && asset.media_type !== "sample_movie")) {
    return "skip";
  }

  if (
    asset.video_analysis_version === expectedVersion
    && currentSourceFingerprint !== null
    && asset.video_analysis_source_fingerprint === currentSourceFingerprint
    && asset.visual_video_facts
  ) {
    return "reuse";
  }

  return "analyze";
}
