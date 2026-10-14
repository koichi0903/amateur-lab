import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cachePreparedBijyoVideo, PreparedVideoAlreadyExistsError, bijyoDesktopSaveDirectory, readCachedBijyoVideo, saveBijyoVideoWithoutOverwrite } from "./bijyoTrimmedVideoStore.ts";

const testWork = process.env.BIJYO_VIDEO_STORE_TEST_ROOT ?? join(process.cwd(), "work");
await mkdir(testWork, { recursive: true });
const root = await mkdtemp(join(testWork, "bijyo-video-store-test-"));
try {
  const cache = join(root, "cache");
  const output = join(root, "Desktop", "Bijyo一時動画");
  const bytes = Buffer.from("mock mp4 bytes");

  await assert.rejects(readCachedBijyoVideo(42, cache), { name: "PreparedVideoNotFoundError" });
  assert.equal(await cachePreparedBijyoVideo(42, bytes, cache), true);
  assert.deepEqual(await readCachedBijyoVideo(42, cache), bytes);
  await cachePreparedBijyoVideo(42, Buffer.from("new prepared video"), cache);
  assert.deepEqual(await readCachedBijyoVideo(42, cache), Buffer.from("new prepared video"), "a new preparation atomically replaces its local cache");
  const mockAtomicNoReplaceLink = async (source: string, destination: string) => {
    await writeFile(destination, await readFile(source), { flag: "wx" });
  };
  const saved = await saveBijyoVideoWithoutOverwrite(42, bytes, output, mockAtomicNoReplaceLink);
  assert.equal(saved.filename, "bijyo_42.mp4");
  assert.deepEqual(await readFile(saved.path), bytes);
  await assert.rejects(saveBijyoVideoWithoutOverwrite(42, Buffer.from("replacement"), output, mockAtomicNoReplaceLink), PreparedVideoAlreadyExistsError);
  assert.deepEqual(await readFile(saved.path), bytes, "existing files are not overwritten");
  assert.equal(bijyoDesktopSaveDirectory("C:\\Users\\DELL\\OneDrive\\Desktop"), "C:\\Users\\DELL\\OneDrive\\Desktop\\Bijyo一時動画");
  await assert.rejects(saveBijyoVideoWithoutOverwrite(0, bytes, output, mockAtomicNoReplaceLink), /workIdが不正です/);
  await assert.rejects(saveBijyoVideoWithoutOverwrite("../escape" as unknown as number, bytes, output, mockAtomicNoReplaceLink), /workIdが不正です/);
} finally {
  await rm(root, { recursive: true, force: true });
}
