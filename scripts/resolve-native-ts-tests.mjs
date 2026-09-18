import { access } from "node:fs/promises";
import { extname, resolve as resolvePath } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const projectRoot = process.cwd();

async function existingFile(path) {
  try {
    await access(path);
    return path;
  } catch {
    return null;
  }
}

export async function resolve(specifier, context, nextResolve) {
  let candidate = null;

  if (specifier.startsWith("@/")) {
    candidate = resolvePath(projectRoot, "src", specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !extname(specifier.split("?")[0].split("#")[0])
  ) {
    candidate = resolvePath(fileURLToPath(new URL(".", context.parentURL)), specifier);
  }

  if (candidate) {
    for (const suffix of ["", ".ts", ".tsx", ".js", ".mjs"]) {
      const file = await existingFile(`${candidate}${suffix}`);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("/") && !extname(specifier)) {
      try {
        return await nextResolve(`${specifier}.js`, context);
      } catch {
        // Preserve the original resolution error for normal module failures.
      }
    }
    throw error;
  }
}
