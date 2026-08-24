import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import { INSTALLED_FOLDER } from "#constants";
import type { ParsedSource } from "#utils/install/parse-source/index";

export default async function removeInstallDirectory({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  if (parsedSource.type === "npm") {
    await removeNpmPackage({ powerupDir, parsedSource });
  } else {
    await removeGitDirectory({ powerupDir, parsedSource });
  }
}

async function removeNpmPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const packageName = parsedSource.configEntry.slice(4);
  const npmDir = powerupDir.append(`/${INSTALLED_FOLDER.npm}`);

  if (!(await fs.exists(npmDir))) {
    return;
  }

  cli.print(`Running npm uninstall in ${npmDir.path}...\n`);
  try {
    const stdout = await io.run(`npm uninstall ${packageName}`, { cwd: npmDir.path });

    if (stdout) {
      cli.print(stdout);
    }
  } catch (error) {
    const message = typeof error === "string" ? error : String(error);

    cli.print(`Warning: npm uninstall failed: ${message}\n`);
  }
}

async function removeGitDirectory({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const targetDir = powerupDir.append(`/${parsedSource.storePath}`);

  if (!(await fs.exists(targetDir))) {
    return;
  }

  await targetDir.remove();
}