import fs, { type FileRef } from "@rcompat/fs";
import p from "pema";
import { MAIN_FOLDER, CONFIG_FILE, PACKAGES_KEY, GLOBAL_CONFIG_PATH } from "#constants";

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
  harness: p.string,
  [PACKAGES_KEY]: p.array(p.unknown).optional(),
});

/**
 * Schema for the global config (~/.<MAIN_FOLDER>/config.json).
 * Unlike the project config, the global config only stores a packages
 * array — `harness` is optional so legacy files without it don't crash.
 */
const globalConfigSchema = p({
  harness: p.string.optional(),
  [PACKAGES_KEY]: p.array(p.unknown).optional(),
});

export type Config = {
  harness: string;
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
    packages: (raw.packages ?? []) as PackageEntry[],
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
export async function readGlobalConfig(): Promise<{ packages: PackageEntry[] }> {
  const configPath = fs.ref(GLOBAL_CONFIG_PATH);

  if (!(await fs.exists(configPath))) {
    return { packages: [] };
  }

  const raw = globalConfigSchema.parse(await configPath.json());
  return {
    packages: (raw.packages ?? []) as PackageEntry[],
  };
}

/**
 * Write the global config to `<GLOBAL_FOLDER>/config.json`.
 * Creates the folder structure if it doesn't exist.
 */
export async function writeGlobalConfig(
  config: { packages: PackageEntry[] },
): Promise<void> {
  const configPath = fs.ref(GLOBAL_CONFIG_PATH);
  await fs.create(configPath.directory);
  await configPath.write(JSON.stringify(config, null, 2) + "\n");
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
 */
export async function addPackageToGlobalConfig(
  entry: PackageEntry,
): Promise<void> {
  const config = await readGlobalConfig();

  const source = getPackageSource(entry);
  const existingIndex = config.packages.findIndex(
    p => getPackageSource(p) === source,
  );

  if (existingIndex >= 0) {
    config.packages[existingIndex] = entry;
  } else {
    config.packages.push(entry);
  }
  await writeGlobalConfig(config);
}