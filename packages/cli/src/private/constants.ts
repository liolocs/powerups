export const CLI_NAME = "saved";

/** Name of the main cli project folder, created at the project root. */
export const MAIN_FOLDER = ".saved";

/** Parent folder for template and feature domains. */
export const OUTPUT_FOLDER = "output";

/** Subfolder for templates (recurring patterns). */
export const TEMPLATE_FOLDER = "template";

/** Subfolder for features (one-time additions). */
export const FEATURE_FOLDER = "feature";

/** Name of the metrics log file, storing one JSON entry per output run. */
export const METRICS_FILE = "metrics.jsonl";

/** Maps a domain name to its folder name. */
export function getDomainFolder(domain: "template" | "feature"): string {
  return domain === "template" ? TEMPLATE_FOLDER : FEATURE_FOLDER;
}

/** Capitalize the first letter of a string. */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}