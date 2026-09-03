import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import {
  INSTALLED_FOLDER,
  NAME_FOR_NPM_PACKAGE_GLOBAL_GROUP,
  PACKAGE_JSON,
} from "#constants";
import install_errors from "#errors/installErrors";
import extractFailedNpmPackage from "#utils/install/fetch-package/extract-failed-npm-package";
import type { ParsedSource } from "#utils/install/parse-source/index";

async function ensureNpmStore(powerupDir: FileRef): Promise<FileRef> {
  const npmDir = powerupDir.append(`/${INSTALLED_FOLDER.npm}`);
  await fs.create(npmDir);

  const pkgJsonPath = npmDir.append(`/${PACKAGE_JSON}`);
  if (!(await fs.exists(pkgJsonPath))) {
    await pkgJsonPath.writeJSON({
      name: NAME_FOR_NPM_PACKAGE_GLOBAL_GROUP,
      private: true,
      dependencies: {},
    });
  }

  const gitignorePath = npmDir.append("/.gitignore");
  if (!(await fs.exists(gitignorePath))) {
    await fs.write(gitignorePath, "*\n!.gitignore\n");
  }

  return npmDir;
}

export default async function fetchNpmPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const packageName = parsedSource.configEntry.slice(4);
  const npmDir = await ensureNpmStore(powerupDir);
  const pkgJsonPath = npmDir.append(`/${PACKAGE_JSON}`);
  const pkgJson = await pkgJsonPath.json() as Record<string, any>;

  if (!pkgJson.dependencies) {
    pkgJson.dependencies = {};
  }

  if (!pkgJson.dependencies[packageName]) {
    pkgJson.dependencies[packageName] = "latest";
  }

  await pkgJsonPath.writeJSON(pkgJson);

  try {
    cli.print(`Running npm install in ${npmDir.path}...\n`);
    const stdout = await io.run("npm install", { cwd: npmDir.path });
    if (stdout) cli.print(stdout);
  } catch (error_) {
    const stderr = typeof error_ === "string" ? error_ : String(error_);

    const failedPackage = extractFailedNpmPackage(stderr);
    const dependencies = Object.keys(pkgJson.dependencies ?? {});
    const isStalePackage = failedPackage !== null
      && failedPackage !== packageName
      && dependencies.includes(failedPackage);

    if (isStalePackage) {
      throw install_errors.stale_npm_package({
        source: parsedSource.configEntry,
        stalePackage: failedPackage!,
      });
    }

    throw install_errors.fetch_failed(parsedSource.configEntry, stderr);
  }
}