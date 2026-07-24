import fs from "@rcompat/fs";
import { homedir } from "node:os";
import path from "node:path";
import init_errors from "#errors/initErrors";
import { HARNESS_FINGERPRINTS } from "#constants";

export const VALID_HARNESSES = ["claude", "opencode", "pi", "codex"] as const;
export type Harness = (typeof VALID_HARNESSES)[number];

/**
 * Detect all active harnesses from global fingerprints.
 *
 * Flow:
 *   1. If harnessFlag is provided, validate and return [single].
 *   2. Scan global fingerprints (~/.claude/, ~/.pi/agent/, ~/.opencode/, ~/.codex/).
 *      - Return all detected harnesses (multiple is OK).
 *   3. Nothing found → throw no_harness_detected.
 *
 * Pass `options.homeDir` to override the home directory (for testing).
 */
export async function detectHarnesses(
  harnessFlag: string | undefined,
  options?: { homeDir?: string },
): Promise<Harness[]> {
  // 1. --harness override
  if (harnessFlag !== undefined) {
    if (!VALID_HARNESSES.includes(harnessFlag as Harness)) {
      throw init_errors.invalid_harness(harnessFlag);
    }
    return [harnessFlag as Harness];
  }

  // 2. Global detection
  const baseDir = options?.homeDir ?? homedir();
  const found = new Set<Harness>();

  for (const harness of VALID_HARNESSES) {
    const checkPath = path.join(baseDir, HARNESS_FINGERPRINTS[harness]);
    if (await fs.exists(fs.ref(checkPath))) {
      found.add(harness);
    }
  }

  if (found.size === 0) {
    throw init_errors.no_harness_detected();
  }

  return [...found];
}