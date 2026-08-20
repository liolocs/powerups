import { homedir } from "node:os";
import path from "node:path";
import string from "@rcompat/string";

export const CLI_CMD = "pup";

export const CLI_NAME = "powerups";

export const SINGULAR_NAME_FOR_CLI = "powerup";
export const CAPITALIZED_SINGLULAR_CLI_NAME = string.upperfirst(SINGULAR_NAME_FOR_CLI);
export const CAPITALIZED_CLI_NAME = string.upperfirst(CLI_NAME);

/** Name of the main cli project folder, created at the project root. */
export const CLI_FOLDER_NAME = "." + CLI_NAME;

/** Subfolder for multi-use powerups (recurring patterns). */
export const MULTI_USE_FOLDER = "multi-use";

/** Subfolder for single-use powerups (one-time additions). */
export const SINGLE_USE_FOLDER = "single-use";

export const CONFIG_FILE_NAME = "config.json";

export const METRICS_FILE_NAME = "metrics.jsonl";

export const POWERUP_MANIFEST_FILE_NAME = "applied.json";

export type PowerUpType = "multi-use" | "single-use";

export const powerupsFolderMap: Record<PowerUpType, string> = {
  "multi-use": MULTI_USE_FOLDER,
  "single-use": SINGLE_USE_FOLDER,
};

export const INSTALLED_FOLDER = {
  internal: "installed/_internal",
  npm: "installed/npm",
  git: "installed/git",
};

export const INTERNAL_FOLDER = "_internal";

export const PACKAGE_JSON = "package.json";

export const PACKAGE_JSON_KEYWORD_PROPERTY = `${CLI_NAME}-package`;

export const CONFIG_POWERUPS_KEY = "packages";

export const GLOBAL_ROOT = path.join(homedir(), CLI_FOLDER_NAME);

export const GLOBAL_CONFIG_PATH = path.join(GLOBAL_ROOT, CONFIG_FILE_NAME);

export const GLOBAL_INTERNAL_PATH = path.join(GLOBAL_ROOT, INTERNAL_FOLDER);

export const FOLDER_FOR_NPM_INSTALLED_PACKAGES = "npm";

export const FOLDER_FOR_GIT_INSTALLED_PACKAGES = "git";

export const NAME_FOR_NPM_PACKAGE_GLOBAL_GROUP = CLI_NAME;

/** Global harness fingerprint paths for detection (relative to homeDir). */
export const HARNESS_FINGERPRINTS = {
  claude: ".claude",
  pi: ".pi",
  opencode: ".opencode",
  codex: ".codex",
};

export const SKILLS_DIRS = {
  claude: ".claude/skills",
  pi: ".pi/skills",
  opencode: ".opencode/skills",
  codex: ".codex/skills",
};