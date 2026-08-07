import fs, { type FileRef } from "@rcompat/fs";
import path from "node:path";
import p from "pema";
import { CLI_FOLDER_NAME, CONFIG_FILE_NAME, CONFIG_POWERUPS_KEY, GLOBAL_CONFIG_PATH, GLOBAL_ROOT } from "#constants";

/**
 * A config `packages` entry.
 *
 * A plain string means "use all powerups from this source". An object allows
 * scoping which powerups are active via `powerups.include` / `powerups.exclude`.
 */
export type PackageEntry = string | {
  package: string;
  powerups?: {
    include?: string[];
    exclude?: string[];
  };
};

/**
 * Normalized form of {@link PackageEntry}: the source string is always under
 * `.package`, regardless of whether the input was a plain string or an object.
 */
export type NormalizedPackageEntry = {
  package: string;
  powerups?: {
    include?: string[];
    exclude?: string[];
  };
};

const configSchema = p({
  [CONFIG_POWERUPS_KEY]: p.array(p.unknown).optional(),
});

export type Config = {
  packages: PackageEntry[];
};

/**
 * Normalize a config package entry into a stable object form.
 * Strings become `{ package: <string> }`; objects are passed through with a
 * shallow copy of their `powerups` filter.
 */
export function normalizePackageEntry(entry: PackageEntry): NormalizedPackageEntry {
  if (typeof entry === "string") {
    return { package: entry };
  }
  const result: NormalizedPackageEntry = { package: entry.package };
  if (entry.powerups) {
    result.powerups = { ...entry.powerups };
  }
  return result;
}

/**
 * Extract the source specifier string from a config package entry
 * (the part that identifies *which* package to resolve, ignoring any filter).
 */
export function getPackageSource(entry: PackageEntry): string {
  return typeof entry === "string" ? entry : entry.package;
}

/**
 * Read the project config from `${CLI_FOLDER_NAME}/config.json`.
 * Returns null if the config file does not exist.
 * If the packages array is missing, it defaults to [].
 */
export async function readConfig(
  projectRoot: FileRef,
): Promise<Config | null> {
  const configPath = projectRoot.append(`/${CLI_FOLDER_NAME}/${CONFIG_FILE_NAME}`);

  if (!(await fs.exists(configPath))) {
    return null;
  }

  const raw = configSchema.parse(await configPath.json());
  return {
    packages: (raw.packages ?? []) as PackageEntry[],
  };
}

/**
 * Write the project config to `${CLI_FOLDER_NAME}/config.json`.
 * Creates the `${CLI_FOLDER_NAME}` folder if it doesn't exist.
 */
export async function writeConfig(
  projectRoot: FileRef,
  config: Config,
): Promise<void> {
  const configPath = projectRoot.append(`/${CLI_FOLDER_NAME}/${CONFIG_FILE_NAME}`);
  await fs.create(configPath.directory);
  await configPath.write(JSON.stringify(config, null, 2) + "\n");
}

/**
 * Read the global config from `~/.<CLI_FOLDER_NAME>/config.json`.
 * Returns null if the file doesn't exist.
 * Accepts an optional `homeDir` for testability (overrides the default
 * global config path derived from `GLOBAL_CONFIG_PATH`).
 */
export async function readGlobalConfig(homeDir?: string): Promise<Config | null> {
  const configPath = homeDir
    ? fs.ref(path.join(homeDir, CLI_FOLDER_NAME, CONFIG_FILE_NAME))
    : fs.ref(GLOBAL_CONFIG_PATH);

  if (!(await fs.exists(configPath))) {
    return null;
  }

  const raw = configSchema.parse(await configPath.json());
  return {
    packages: (raw.packages ?? []) as PackageEntry[],
  };
}

/**
 * Write the global config to `~/.<CLI_FOLDER_NAME>/config.json`.
 * Creates the folder structure if it doesn't exist.
 * Accepts an optional `homeDir` for testability.
 */
export async function writeGlobalConfig(
  config: Config,
  homeDir?: string,
): Promise<void> {
  const configPath = homeDir
    ? fs.ref(path.join(homeDir, CLI_FOLDER_NAME, CONFIG_FILE_NAME))
    : fs.ref(GLOBAL_CONFIG_PATH);
  await fs.create(configPath.directory);
  await configPath.write(JSON.stringify(config, null, 2) + "\n");
}

/**
 * Ensure the global powerups store (`~/.powerups/`) and its config exist.
 * Creates the folder + `config.json` (`{ packages: [] }`) when missing;
 * no-op (does not overwrite) when already present.
 *
 * Returns `true` if it created the store, `false` if it already existed.
 * Accepts an optional `homeDir` for testability.
 */
export async function ensureGlobalInit(homeDir?: string): Promise<boolean> {
  const globalRoot = homeDir
    ? fs.ref(path.join(homeDir, CLI_FOLDER_NAME))
    : fs.ref(GLOBAL_ROOT);

  if (await fs.exists(globalRoot)) {
    return false;
  }

  await writeGlobalConfig({ packages: [] }, homeDir);
  return true;
}

/**
 * Add a package entry to the project config's packages array.
 * If an entry with the same source already exists, it is replaced (update).
 * Does nothing if the project config doesn't exist.
 */
export async function addPackageToConfig(
  projectRoot: FileRef,
  entry: PackageEntry,
): Promise<void> {
  const config = await readConfig(projectRoot);
  if (config === null) return;

  const source = getPackageSource(entry);
  const existingIndex = config.packages.findIndex(
    p => getPackageSource(p) === source,
  );

  if (existingIndex >= 0) {
    config.packages[existingIndex] = entry;
  } else {
    config.packages.push(entry);
  }
  await writeConfig(projectRoot, config);
}

/**
 * Remove a package from the project config's packages array, matching by
 * source specifier. Does nothing if the package is not listed or the project
 * config doesn't exist.
 */
export async function removePackageFromConfig(
  projectRoot: FileRef,
  source: string,
): Promise<void> {
  const config = await readConfig(projectRoot);
  if (config === null) return;

  config.packages = config.packages.filter(p => getPackageSource(p) !== source);
  await writeConfig(projectRoot, config);
}

/**
 * Add a package entry to the global config's packages array.
 * If an entry with the same source already exists, it is replaced (update).
 * Accepts an optional `homeDir` for testability.
 */
export async function addPackageToGlobalConfig(
  entry: PackageEntry,
  homeDir?: string,
): Promise<void> {
  const config = (await readGlobalConfig(homeDir)) ?? { packages: [] };

  const source = getPackageSource(entry);
  const existingIndex = config.packages.findIndex(
    p => getPackageSource(p) === source,
  );

  if (existingIndex >= 0) {
    config.packages[existingIndex] = entry;
  } else {
    config.packages.push(entry);
  }
  await writeGlobalConfig(config, homeDir);
}