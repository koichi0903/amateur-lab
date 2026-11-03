import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { link, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

export class PreparedVideoNotFoundError extends Error {
  constructor(message = "この動画のローカル保存データがありません。動画を準備し直すと保存できます。") {
    super(message);
    this.name = "PreparedVideoNotFoundError";
  }
}

export class PreparedVideoAlreadyExistsError extends Error {
  constructor(filename: string) {
    super(`保存先に ${filename} がすでにあります。上書きせず保存を中止しました。`);
    this.name = "PreparedVideoAlreadyExistsError";
  }
}

function validWorkId(workId: number) {
  return Number.isSafeInteger(workId) && workId > 0;
}

export function canUseLocalBijyoVideoStore() {
  return process.platform === "win32" && process.env.VERCEL !== "1" && Boolean(process.env.LOCALAPPDATA);
}

function localCacheRoot() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!canUseLocalBijyoVideoStore() || !localAppData || !isAbsolute(localAppData)) {
    throw new Error("トリム動画のローカル保存はWindows上のローカルアプリでのみ利用できます。");
  }
  return join(localAppData, "amateur-lab", "bijyo-trimmed-videos");
}

async function ensurePlainDirectory(directory: string) {
  await mkdir(directory, { recursive: true });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("保存先に通常のフォルダ以外が指定されています。");
}

export async function cachePreparedBijyoVideo(workId: number, bytes: Uint8Array, root?: string) {
  if (!validWorkId(workId)) throw new Error("workIdが不正です。");
  if (!root && !canUseLocalBijyoVideoStore()) return false;
  const cacheRoot = root ? resolve(root) : localCacheRoot();
  await ensurePlainDirectory(cacheRoot);
  const target = join(cacheRoot, `bijyo_${workId}.mp4`);
  const temporary = join(cacheRoot, `.bijyo_${workId}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  return true;
}

export async function readCachedBijyoVideo(workId: number, root = localCacheRoot()) {
  if (!validWorkId(workId)) throw new Error("workIdが不正です。");
  const filename = `bijyo_${workId}.mp4`;
  const resolvedRoot = resolve(root);
  const file = join(resolvedRoot, filename);
  try {
    const rootInfo = await lstat(resolvedRoot);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new PreparedVideoNotFoundError();
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size <= 0) throw new PreparedVideoNotFoundError();
    return await readFile(file);
  } catch (error) {
    if (error instanceof PreparedVideoNotFoundError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new PreparedVideoNotFoundError();
    throw error;
  }
}

function windowsKnownFolderDesktop() {
  if (process.platform !== "win32") throw new Error("デスクトップへの動画保存はWindows上のローカルアプリでのみ利用できます。");
  const configuredDesktop = process.env.BIJYO_VIDEO_DESKTOP_DIR?.trim();
  if (configuredDesktop) {
    if (!isAbsolute(configuredDesktop)) throw new Error("動画保存先フォルダーが絶対パスではありません。");
    return resolve(configuredDesktop);
  }
  const desktop = execFileSync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "[Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)",
  ], { encoding: "utf8", timeout: 5_000, windowsHide: true }).trim();
  if (!desktop || !isAbsolute(desktop)) throw new Error("Windowsのデスクトップフォルダーを特定できませんでした。");
  return desktop;
}

export function bijyoDesktopSaveDirectory(desktop = windowsKnownFolderDesktop()) {
  if (!isAbsolute(desktop)) throw new Error("Windowsのデスクトップフォルダーを特定できませんでした。");
  return resolve(desktop, "Bijyo一時動画");
}

export async function saveBijyoVideoWithoutOverwrite(workId: number, bytes: Uint8Array, directory: string, createLink: (source: string, destination: string) => Promise<void> = link) {
  if (!validWorkId(workId)) throw new Error("workIdが不正です。");
  const filename = `bijyo_${workId}.mp4`;
  const root = resolve(directory);
  await ensurePlainDirectory(root);
  const target = join(root, filename);
  const temporary = join(root, `.bijyo_${workId}.${randomUUID()}.tmp`);
  await writeFile(temporary, bytes, { flag: "wx" });
  try {
    // A hard-link create is atomic and fails with EEXIST instead of replacing an existing file.
    await createLink(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new PreparedVideoAlreadyExistsError(filename);
    throw error;
  }
  await unlink(temporary).catch(() => undefined);
  return { filename, path: target };
}

export async function savePreparedBijyoVideoToDesktop(workId: number, bytes: Uint8Array) {
  const desktop = windowsKnownFolderDesktop();
  await ensurePlainDirectory(desktop);
  const directory = bijyoDesktopSaveDirectory(desktop);
  return saveBijyoVideoWithoutOverwrite(workId, bytes, directory);
}
