import fs, { type FileRef } from "@rcompat/fs";
import p from "pema";
import { MAIN_FOLDER, CONFIG_FILE } from "#constants";

const configSchema = p({
  harness: p.string,
});

export type Config = (typeof configSchema)["infer"];

/**
 * Read the saved project config from `.saved/config.json`.
 * Returns null if the config file does not exist.
 */
export async function readConfig(
  projectRoot: FileRef,
): Promise<Config | null> {
  const configPath = projectRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`);

  if (!(await fs.exists(configPath))) {
    return null;
  }

  return configSchema.parse(await configPath.json());
}

/**
 * Write the saved project config to `.saved/config.json`.
 * Creates the `.saved` folder if it doesn't exist.
 */
export async function writeConfig(
  projectRoot: FileRef,
  config: Config,
): Promise<void> {
  const configPath = projectRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`);
  await fs.create(configPath.directory);
  await configPath.write(JSON.stringify(config, null, 2) + "\n");
}