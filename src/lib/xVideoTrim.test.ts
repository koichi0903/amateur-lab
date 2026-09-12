import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { probeVideoFile } from "./xVideoTrim";

const require = createRequire(import.meta.url);
const ffmpegPath = require.resolve("@ffmpeg-installer/win32-x64/ffmpeg.exe");

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr)));
  });
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "x-trim-test-"));
  try {
    const source = join(dir, "source.mp4");
    await run(ffmpegPath, [
      "-y",
      "-f", "lavfi",
      "-i", "testsrc=size=320x180:rate=30:duration=2",
      "-f", "lavfi",
      "-i", "sine=frequency=1000:duration=2",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-movflags", "+faststart",
      source,
    ]);
    const probe = await probeVideoFile(source);
    assert.equal(probe.codec, "h264");
    assert.equal(probe.audioCodec, "aac");
    assert.ok(probe.durationSeconds >= 1.9);
    await writeFile(join(dir, "ok.txt"), "ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void main();
