import { SINGULAR_NAME_FOR_CLI } from "#constants";
import { type Instructions, powerupPropertySchema, type PowerupProperty } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import tsup from "tsup";
import path from "node:path";
import build_errors from "#errors/buildErrors";

type CompiledIndexFile = {
  default: {
    instructions: Instructions;
    source: string;
  };
};

export default async function compileIndexFile({
  root,
  pkgJson,
}: {
    root: FileRef;
    pkgJson: Record<string, unknown>;
  }): Promise<{
    compiledIndexFile: CompiledIndexFile;
    validatedPowerup: PowerupProperty;
    outputFolder: FileRef;
  }> {
  const validatedPowerup = await getValidatedPowerupProperty(pkgJson);
  const distFolderRef = root.append("/dist");

  await cleanUpDistFolder(distFolderRef);

  const entryPath = path.resolve(root.path, validatedPowerup.instructions);
  const outDirPath = path.resolve(root.path, "dist");

  await tsup.build({
    entry: [entryPath],
    outDir: outDirPath,
    format: ["esm"],
    // dts emission deferred — TS 6.0 baseUrl deprecation in tsup's dts pipeline;
    // re-enable once the dts/tsconfig friction is resolved (type-safety across packages).
    dts: false,
    external: getAllDependenciesWeWantToExcludeFromBuild(pkgJson),
    splitting: false,
    clean: false,
    silent: true,
  });


  // Node's ESM loader caches dynamic imports by URL and does NOT re-read the
  // file on subsequent imports of the same path (no mtime check). Without a
  // cache-busting query string, a second build into the same dist/index.js
  // path within one process returns the stale module from the first build.
  const compiledIndexFile: CompiledIndexFile =
    await import(`${distFolderRef.path}/index.js?t=${Date.now()}`);

  checkCompiledIndexFileForValidExports({
    compiledIndexFile,
    instructionsPath: validatedPowerup.instructions,
  });

  return {
    compiledIndexFile,
    validatedPowerup,
    outputFolder: distFolderRef,
  };
}

function getAllDependenciesWeWantToExcludeFromBuild(
  pkgJson: Record<string, unknown>,
): string[] {
  const dependenciesWeWantToExclude: string[] = [];
  const dependencyKeys = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const;

  for (const key of dependencyKeys) {
    const deps = pkgJson[key] as Record<string, string> | undefined;

    if (is.truthy(deps) && typeof deps === "object") {
      dependenciesWeWantToExclude.push(...Object.keys(deps));
    }
  }

  return dependenciesWeWantToExclude;
}

async function cleanUpDistFolder(distFolderRef: FileRef): Promise<void> {
  if (await distFolderRef.exists()) {
    await distFolderRef.remove({ recursive: true });
  }

  await distFolderRef.create();
}

async function getValidatedPowerupProperty(
  pkgJson: Record<string, unknown>,
): Promise<PowerupProperty> {
  const validatedPowerup = powerupPropertySchema
    .safeParse(pkgJson[SINGULAR_NAME_FOR_CLI]);

  if (!validatedPowerup.success) {
    const error = "Something went wrong, this was not validated previously";

    throw new Error(error);
  }

  return validatedPowerup.data;
}

function checkCompiledIndexFileForValidExports({
  compiledIndexFile,
  instructionsPath,
}: { compiledIndexFile: any; instructionsPath: string }): void {
  if (
    is.falsy(compiledIndexFile.default) ||
    typeof compiledIndexFile.default !== "object" ||
    is.falsy(compiledIndexFile.default.instructions)
  ) {
    throw build_errors.invalid_instructions_file(instructionsPath);
  }
}
