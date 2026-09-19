export type OpeningFrameSample = {
  timeSec: number;
  brightness: number;
  detail: number;
  colorVariance: number;
};

export type OpeningBrightnessSample = { timeSec: number; brightness: number };

const BLACK_INTRO_MAX_ANALYSIS_SECONDS = 8;
const BLACK_INTRO_MAX_TRIM_SECONDS = 10;
const BLACK_INTRO_DARK_THRESHOLD = 0.12;
const BLACK_INTRO_BRIGHT_THRESHOLD = 0.16;
const BLACK_INTRO_MIN_DARK_SECONDS = 0.5;
const BLACK_INTRO_STABLE_BRIGHT_SECONDS = 0.5;
const BLANK_INTRO_MAX_ANALYSIS_SECONDS = 8;
const BLANK_INTRO_DARK_THRESHOLD = 0.12;
const BLANK_INTRO_BRIGHT_THRESHOLD = 0.88;
const BLANK_INTRO_MAX_DETAIL = 0.035;
const BLANK_INTRO_MAX_COLOR_VARIANCE = 0.025;
const BLANK_INTRO_MIN_SECONDS = 0.5;

function isLowInformationBlank(sample: OpeningFrameSample) {
  return sample.detail <= BLANK_INTRO_MAX_DETAIL && sample.colorVariance <= BLANK_INTRO_MAX_COLOR_VARIANCE;
}

function isBlankIntroStart(sample: OpeningFrameSample) {
  const isBlackOrWhite = sample.brightness <= BLANK_INTRO_DARK_THRESHOLD || sample.brightness >= BLANK_INTRO_BRIGHT_THRESHOLD;
  return isBlackOrWhite && isLowInformationBlank(sample);
}

/** Detects a dark, bright, or nearly single-colour low-information opening. */
export function detectBlankIntroEnd(samples: OpeningFrameSample[], durationSec: number) {
  const ordered = [...samples]
    .sort((a, b) => a.timeSec - b.timeSec)
    .filter((sample) => sample.timeSec >= 0 && sample.timeSec <= Math.min(BLANK_INTRO_MAX_ANALYSIS_SECONDS, durationSec));
  if (ordered.length < 2 || !isBlankIntroStart(ordered[0])) return { endSec: 0, kind: null as "black" | "white" | null };

  let blankEndIndex = 0;
  while (blankEndIndex + 1 < ordered.length && isLowInformationBlank(ordered[blankEndIndex + 1])) blankEndIndex += 1;
  const blankDuration = ordered[blankEndIndex].timeSec - ordered[0].timeSec;
  if (blankDuration < BLANK_INTRO_MIN_SECONDS || blankEndIndex >= ordered.length - 1) return { endSec: 0, kind: null as "black" | "white" | null };

  const endSec = Number(ordered[blankEndIndex + 1].timeSec.toFixed(1));
  return {
    endSec,
    kind: ordered[0].brightness <= BLANK_INTRO_DARK_THRESHOLD ? "black" as const : "white" as const,
  };
}

/** Detects only a dark opening followed by a stable return to usable brightness. */
export function detectBlackIntroEnd(samples: OpeningBrightnessSample[], durationSec: number) {
  const ordered = [...samples].sort((a, b) => a.timeSec - b.timeSec).filter((sample) => sample.timeSec >= 0 && sample.timeSec <= Math.min(BLACK_INTRO_MAX_ANALYSIS_SECONDS, durationSec));
  if (ordered.length < 2 || ordered[0].brightness >= BLACK_INTRO_DARK_THRESHOLD) return 0;

  let darkEndIndex = 0;
  while (darkEndIndex + 1 < ordered.length && ordered[darkEndIndex + 1].brightness < BLACK_INTRO_DARK_THRESHOLD) darkEndIndex += 1;
  const darkDuration = ordered[darkEndIndex].timeSec - ordered[0].timeSec;
  if (darkDuration < BLACK_INTRO_MIN_DARK_SECONDS) return 0;

  for (let start = darkEndIndex + 1; start < ordered.length; start += 1) {
    if (ordered[start].brightness < BLACK_INTRO_BRIGHT_THRESHOLD) continue;
    const stableUntil = ordered[start].timeSec + BLACK_INTRO_STABLE_BRIGHT_SECONDS;
    const stable = ordered.filter((sample) => sample.timeSec >= ordered[start].timeSec && sample.timeSec <= stableUntil).every((sample) => sample.brightness >= BLACK_INTRO_BRIGHT_THRESHOLD);
    if (stable && ordered[start].timeSec <= BLACK_INTRO_MAX_TRIM_SECONDS) return Number(ordered[start].timeSec.toFixed(1));
  }
  return 0;
}
