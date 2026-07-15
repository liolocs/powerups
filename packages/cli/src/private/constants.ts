export const CLI_NAME = "saved";

/** Name of the main cli project folder, created at the project root. */
export const MAIN_FOLDER = ".saved";

/** Parent folder for template and feature domains. */
export const OUTPUT_FOLDER = "output";

/** Subfolder for templates (recurring patterns). */
export const TEMPLATE_FOLDER = "template";

/** Subfolder for features (one-time additions). */
export const FEATURE_FOLDER = "feature";

/** Name of the config file storing project settings (e.g. chosen harness). */
export const CONFIG_FILE = "config.json";

/** Name of the metrics log file, storing one JSON entry per output run. */
export const METRICS_FILE = "metrics.jsonl";

export const domainFolderMap: Record<"template" | "feature", string> = {
  template: TEMPLATE_FOLDER,
  feature: FEATURE_FOLDER,
};