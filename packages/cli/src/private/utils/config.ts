import fs, { type FileRef } from "@rcompat/fs";
import p from "pema";
import { MAIN_FOLDER, CONFIG_FILE, PACKAGES_KEY, GLOBAL_CONFIG_PATH } from "#constants";

const configSchema = p({
  harness: p.string,
  [PACKAGES_KEY]: p.array(p.string).optional(),
});

/**
 * Schema for the global config (~/.<MAIN_FOLDER>/config.json).
 * Unlike the project config, the global config only stores a packages
 * array — `harness` is optional so legacy files without it don't crash.
 */
const globalConfigSchema = p({
  harness: p.string.optional(),
  [PACKAGES_KEY]: p.array(p.string).optional(),
});

export type Config = {
  harness: string;
  packages: string[];
};

/**
 * Read the project config from `${MAIN_FOLDER}/config.json`.
 * Returns null if the config file does not exist.
 * If the packages array is missing, it defaults to [].
 */
export async function readConfig(
  projectRoot: FileRef,
): Promise<Config | null> {
  const configPath = projectRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`);

  if (!(await fs.exists(configPath))) {
    return null;
  }

  const raw = configSchema.parse(await configPath.json());
  return {
    harness: raw.harness,
    packages: raw.packages ?? [],
  };
}

/**
 * Write the project config to `${MAIN_FOLDER}/config.json`.
 * Creates the `${MAIN_FOLDER}` folder if it doesn't exist.
 */
export async function writeConfig(
  projectRoot: FileRef,
  config: Config,
): Promise<void> {
  const configPath = projectRoot.append(`/${MAIN_FOLDER}/${CONFIG_FILE}`);
  await fs.create(configPath.directory);
  await configPath.write(JSON.stringify(config, null, 2) + "\n");
}

/**
 * Read the global config from `<GLOBAL_FOLDER>/config.json`.
 * Returns { packages: [] } if the file doesn't exist (graceful degradation).
 */
export async function readGlobalConfig(): Promise<{ packages: string[] }> {
  const configPath = fs.ref(GLOBAL_CONFIG_PATH);

  if (!(await fs.exists(configPath))) {
    return { packages: [] };
  }

  const raw = globalConfigSchema.parse(await configPath.json());
  return {
    packages: raw.packages ?? [],
  };
}

/**
 * Write the global config to `<GLOBAL_FOLDER>/config.json`.
 * Creates the folder structure if it doesn't exist.
 */
export async function writeGlobalConfig(
  config: { packages: string[] },
): Promise<void> {
  const configPath = fs.ref(GLOBAL_CONFIG_PATH);
  await fs.create(configPath.directory);
  await configPath.write(JSON.stringify(config, null, 2) + "\n");
}

/**
 * Add a package name to the project config's packages array.
 * Does nothing if the package is already listed.
 * Does nothing if the project config doesn't exist.
 */
export async function addPackageToConfig(
  projectRoot: FileRef,
  packageName: string,
): Promise<void> {
  const config = await readConfig(projectRoot);
  if (config === null) return;

  if (!config.packages.includes(packageName)) {
    config.packages.push(packageName);
    await writeConfig(projectRoot, config);
  }
}

/**
 * Remove a package name from the project config's packages array.
 * Does nothing if the package is not listed.
 * Does nothing if the project config doesn't exist.
 */
export async function removePackageFromConfig(
  projectRoot: FileRef,
  packageName: string,
): Promise<void> {
  const config = await readConfig(projectRoot);
  if (config === null) return;

  config.packages = config.packages.filter(p => p !== packageName);
  await writeConfig(projectRoot, config);
}

/**
 * Add a package name to the global config's packages array.
 * Does nothing if the package is already listed.
 */
export async function addPackageToGlobalConfig(
  packageName: string,
): Promise<void> {
  const config = await readGlobalConfig();

  if (!config.packages.includes(packageName)) {
    config.packages.push(packageName);
    await writeGlobalConfig(config);
  }
}