import fs, { type FileRef } from "@rcompat/fs";
import path from "node:path";
import { homedir } from "node:os";
import { CLI_FOLDER_NAME, CONFIG_FILE_NAME } from "#constants";

export default async function setupPowerupDir({
  isLocal,
  projectRoot,
  homeDir,
}: {
  isLocal: boolean;
  projectRoot: FileRef;
  homeDir?: string;
}): Promise<{ root: FileRef; powerupDir: FileRef }> {
  const powerupDir = isLocal
    ? projectRoot.append(`/${CLI_FOLDER_NAME}`)
    : fs.ref(path.join(homeDir ?? homedir(), CLI_FOLDER_NAME));

  if (!(await fs.exists(powerupDir))) {
    await fs.create(powerupDir);
  }

  const configPath = powerupDir.append(`/${CONFIG_FILE_NAME}`);
  if (!(await fs.exists(configPath))) {
    await fs.write(configPath, JSON.stringify({ packages: [] }) + "\n");
  }

  const root = isLocal ? projectRoot : powerupDir;

  return { root, powerupDir };
}