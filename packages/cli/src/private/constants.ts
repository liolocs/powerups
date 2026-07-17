export const CLI_CMD = "pwrs";

export const CLI_NAME = "powers";

/** Name of the main cli project folder, created at the project root. */
export const MAIN_FOLDER = ".powers";

/** Parent folder for power types. */
export const ACTIVE_FOLDER = "active";

/** Subfolder for multi-use powers (recurring patterns). */
export const MULTI_USE_FOLDER = "multi-use";

/** Subfolder for single-use powers (one-time additions). */
export const SINGLE_USE_FOLDER = "single-use";

/** Subfolder inside a power directory holding its template files. */
export const TEMPLATE_FOLDER = "template";

/** Name of the config file storing project settings (e.g. chosen harness). */
export const CONFIG_FILE = "config.json";

/** Name of the metrics log file, storing one JSON entry per output run. */
export const METRICS_FILE = "metrics.jsonl";

export type PowerType = "multi-use" | "single-use";

export const powerFolderMap: Record<PowerType, string> = {
  "multi-use": MULTI_USE_FOLDER,
  "single-use": SINGLE_USE_FOLDER,
};