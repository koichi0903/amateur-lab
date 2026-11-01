import type { PixelStats } from "@/lib/xVideoAnalysisMetrics";

function isPpmWhitespace(value: number | undefined) {
  return value === 10 || value === 13 || value === 32 || value === 9;
}

function skipPpmWhitespaceAndComments(buffer: Buffer, startIndex: number) {
  let index = startIndex;
  while (true) {
    while (isPpmWhitespace(buffer[index])) index++;
    if (index >= buffer.length) throw new Error("ffmpeg did not return PPM");
    if (buffer[index] !== 35) return index;
    while (index < buffer.length && buffer[index] !== 10) index++;
    if (index >= buffer.length) throw new Error("ffmpeg did not return PPM");
    index++;
  }
}

function readPpmHeader(buffer: Buffer) {
  const tokens: string[] = [];
  let index = 2;
  while (tokens.length < 3) {
    index = skipPpmWhitespaceAndComments(buffer, index);
    const tokenStart = index;
    while (buffer[index] > 32) index++;
    if (tokenStart === index) throw new Error("ffmpeg did not return PPM");
    tokens.push(buffer.subarray(tokenStart, index).toString());
  }
  if (!isPpmWhitespace(buffer[index])) throw new Error("ffmpeg did not return PPM");
  const separator = buffer[index++];
  if (separator === 13 && buffer[index] === 10) index++;
  const [width, height, max] = tokens.map(Number);
  if (![width, height, max].every(Number.isInteger) || width <= 0 || height <= 0 || max <= 0 || max > 255) {
    throw new Error("ffmpeg did not return PPM");
  }
  return { width, height, max, index };
}

function pixelMetrics(values: Buffer, width: number, height: number, max: number): PixelStats {
  const pixels = width * height;
  if (values.length < pixels * 3) throw new Error("ffmpeg did not return PPM");
  let red = 0, green = 0, blue = 0;
  const histogram = Array.from({ length: 8 }, () => 0);
  let brightness = 0, brightnessSquared = 0, detail = 0;

  for (let index = 0; index < pixels; index++) {
    const r = values[index * 3] / max;
    const g = values[index * 3 + 1] / max;
    const b = values[index * 3 + 2] / max;
    red += r;
    green += g;
    blue += b;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    brightness += luminance;
    histogram[Math.min(7, Math.floor(luminance * 8))]++;
  }

  for (let index = 0; index < pixels; index++) {
    const r = values[index * 3] / max;
    const g = values[index * 3 + 1] / max;
    const b = values[index * 3 + 2] / max;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    brightnessSquared += luminance * luminance;
    if (index % width !== 0) {
      const previous = (
        0.2126 * values[(index - 1) * 3]
        + 0.7152 * values[(index - 1) * 3 + 1]
        + 0.0722 * values[(index - 1) * 3 + 2]
      ) / max;
      detail += Math.abs(luminance - previous);
    }
  }

  const meanBrightness = brightness / pixels;
  return {
    brightness: meanBrightness,
    red: red / pixels,
    green: green / pixels,
    blue: blue / pixels,
    histogram: histogram.map((count) => count / pixels),
    detail: detail / Math.max(1, pixels - height),
    colorVariance: Math.max(0, brightnessSquared / pixels - meanBrightness * meanBrightness),
  };
}

export function parsePpm(buffer: Buffer): PixelStats {
  if (buffer.subarray(0, 2).toString() !== "P6") throw new Error("ffmpeg did not return PPM");
  const header = readPpmHeader(buffer);
  return pixelMetrics(buffer.subarray(header.index), header.width, header.height, header.max);
}
