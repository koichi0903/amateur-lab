import type { VideoAnalysisResult } from "./xVideoAnalysis.ts";

export type BijyoVideoPreparationMode = "auto" | "manual" | undefined;

export type BijyoTrimValidation =
  | { ok: true; value: number }
  | { ok: false; error: string };

export type BijyoTrimPlanDependencies = {
  validate: (value: unknown) => BijyoTrimValidation;
  analyze: (input: { sourceUrl: string; jacketUrl: null }) => Promise<VideoAnalysisResult>;
  calculate: (analysis: VideoAnalysisResult, existingTrimStartSeconds?: number) => { trimStartSeconds: number; reason: string };
};

export async function resolveBijyoTrimPlan(input: {
  mode: BijyoVideoPreparationMode;
  trimStartSeconds: number;
  requestedTrimStartSeconds?: unknown;
  trimReason: string;
  sourceUrl: string;
}, dependencies: BijyoTrimPlanDependencies) {
  if (input.mode === "manual") {
    const validation = dependencies.validate(input.requestedTrimStartSeconds);
    if (!validation.ok) throw new Error(validation.error);
    return { trimStartSeconds: validation.value, reason: "manual_override" };
  }

  if (input.mode !== "auto" && input.trimReason === "manual_override") {
    return { trimStartSeconds: Number(input.trimStartSeconds), reason: "manual_override" };
  }

  const analysis = await dependencies.analyze({ sourceUrl: input.sourceUrl, jacketUrl: null });
  return dependencies.calculate(analysis, input.mode === "auto" ? 0 : input.trimStartSeconds);
}
