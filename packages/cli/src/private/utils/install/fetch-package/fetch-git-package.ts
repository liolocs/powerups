import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import io from "@rcompat/io";
import install_errors from "#errors/installErrors";
import type { ParsedSource } from "#utils/install/parse-source/index";

export default async function fetchGitPackage({
  powerupDir,
  parsedSource,
}: {
  powerupDir: FileRef;
  parsedSource: ParsedSource;
}): Promise<void> {
  const targetDir = powerupDir.append(`/${parsedSource.storePath}`);

  if (await fs.exists(targetDir)) {
    try {
      cli.print(`Updating ${parsedSource.configEntry}...\n`);
      await io.run("git pull", { cwd: targetDir.path });
    } catch (error_) {
      const message = typeof error_ === "string" ? error_ : String(error_);
      throw install_errors.fetch_failed(parsedSource.configEntry, message);
    }
  } else {
    try {
      cli.print(`Cloning ${parsedSource.configEntry}...\n`);
      await fs.create(targetDir.directory);
      await io.run(`git clone --depth 1 "${parsedSource.cloneUrl}" "${targetDir.path}"`);
    } catch (error_) {
      const message = typeof error_ === "string" ? error_ : String(error_);
      throw install_errors.fetch_failed(parsedSource.configEntry, message);
    }
  }
}