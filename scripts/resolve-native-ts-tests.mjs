import { stat } from "node:fs/promises";
import { extname, resolve as resolvePath } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const projectRoot = process.cwd();

function getCandidatePath(specifier, context) {
  if (specifier.startsWith("@/")) {
    return resolvePath(projectRoot, "src", specifier.slice(2));
  }
  const extensionlessRelative =
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !extname(specifier.split("?")[0].split("#")[0]);
  return extensionlessRelative
    ? resolvePath(fileURLToPath(new URL(".", context.parentURL)), specifier)
    : null;
}

async function resolveCandidateFile(candidate) {
  for (const suffix of ["", ".ts", ".tsx", ".js", ".mjs"]) {
    const file = await existingFile(`${candidate}${suffix}`);
    if (file) return file;
  }
  for (const suffix of [".ts", ".tsx", ".js", ".mjs"]) {
    const file = await existingFile(`${candidate}/index${suffix}`);
    if (file) return file;
  }
  return null;
}

function isExtensionlessBareSpecifier(specifier) {
  return !specifier.startsWith(".") && !specifier.startsWith("/") && !extname(specifier);
}

async function existingFile(path) {
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch {
    return null;
  }
}

export async function resolve(specifier, context, nextResolve) {
  const candidate = getCandidatePath(specifier, context);
  if (candidate) {
    const file = await resolveCandidateFile(candidate);
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (isExtensionlessBareSpecifier(specifier)) {
      try {
        return await nextResolve(`${specifier}.js`, context);
      } catch {
        // Preserve the original resolution error for normal module failures.
      }
    }
    throw error;
  }
}
