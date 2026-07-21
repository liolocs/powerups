import { homedir } from "node:os";
import path from "node:path";
import string from "@rcompat/string";

export const CLI_CMD = "pup";

export const CLI_NAME = "powerups";

export const SINGULAR_NAME = "powerup";
export const CAPITALIZED_SINGLULAR_CLI_NAME = string.upperfirst(SINGULAR_NAME);
export const CAPITALIZED_CLI_NAME = string.upperfirst(CLI_NAME);

/** Name of the main cli project folder, created at the project root. */
export const MAIN_FOLDER = "." + CLI_NAME;

export const ACTIVE_FOLDER = "active";

/** Subfolder for multi-use powerups (recurring patterns). */
export const MULTI_USE_FOLDER = "multi-use";

/** Subfolder for single-use powerups (one-time additions). */
export const SINGLE_USE_FOLDER = "single-use";

/** Subfolder inside a powerups directory holding its template files. */
export const TEMPLATE_FOLDER = "template";

/** Name of the config file storing project settings (e.g. chosen harness). */
export const CONFIG_FILE = "config.json";

/** Name of the metrics log file, storing one JSON entry per output run. */
export const METRICS_FILE = "metrics.jsonl";

export type PowerUpType = "multi-use" | "single-use";

export const powerupsFolderMap: Record<PowerUpType, string> = {
  "multi-use": MULTI_USE_FOLDER,
  "single-use": SINGLE_USE_FOLDER,
};

/** Subfolder inside .<MAIN_FOLDER>/ (or ~/.<MAIN_FOLDER>/) holding local packages. */
export const INTERNAL_FOLDER = "internal";

/** Source folder inside a package. */
export const SRC_FOLDER = "src";

/** Name of the package.json file. */
export const PACKAGE_FILE = "package.json";

/** Keyword used in package.json so npm can find powerups packages. */
export const KEYWORD_PACKAGE = `${CLI_NAME}-package`;

/** Property name in config.json listing installed packages. */
export const PACKAGES_KEY = "packages";

/** Path to the global powerups directory (~/.<MAIN_FOLDER>/). */
export const GLOBAL_ROOT = path.join(homedir(), MAIN_FOLDER);

/** Path to the global config file (~/.<MAIN_FOLDER>/config.json). */
export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_ROOT, CONFIG_FILE);

/** Path to the global internal packages folder (~/.<MAIN_FOLDER>/internal/). */
export const GLOBAL_INTERNAL_PATH = path.join(GLOBAL_ROOT, INTERNAL_FOLDER);