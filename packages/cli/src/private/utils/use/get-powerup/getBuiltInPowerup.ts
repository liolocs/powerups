import path from "node:path";
import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import type { Instructions } from "@liolocs/powerups-sdk";
import use_errors from "#errors/useErrors";

export default async function getBuiltInPowerup({
  name,
}: {
  name: string;
}): Promise<{
  instructions: Instructions;
  location: FileRef;
  version: string;
}> {
  const powerupDir = await resolveBuiltinDir(name);

  if (!(await powerupDir.exists())) {
    throw use_errors.powerup_missing(name);
  }

  const instructions = await powerupDir
    .append("/dist/instructions.json")
    .json() as Instructions;

  let version: string;
  try {
    const pkgJson = await powerupDir
      .append("/package.json")
      .json() as Record<string, unknown>;

    if (is.falsy(pkgJson.version)) {
      throw new Error("version not found");
    }

    version = pkgJson.version as string;
  } catch {
    throw use_errors.package_json_error(name);
  }

  return {
    instructions,
    location: powerupDir,
    version,
  };
}

/**
 * Built-in powerups ship inside the CLI package itself so they work regardless
 * of where `pup` is run — no install / config registration required.
 *
 * Resolution mirrors the `scaffold` asset pattern:
 *   - bundled (published `lib/bin.js`): assets live under `lib/private/builtin/`
 *     next to the bundle, so `import.meta.dirname` (the `lib/` dir) is the anchor.
 *   - source (non-bundled dev): assets live in the repo's `.powerups` dir, found
 *     by walking up from this file to the CLI package root.
 */
async function resolveBuiltinDir(name: string): Promise<FileRef> {
  if (is.truthy(process.env.BUNDLED)) {
    return fs.ref(path.join(import.meta.dirname, "private/builtin", name));
  }

  const pkgRoot = await runtime.projectRoot(import.meta.dirname);
  return pkgRoot.append(`/.powerups/installed/_internal/${name}`);
}