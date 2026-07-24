import fs from "@rcompat/fs";
import { homedir } from "node:os";
import path from "node:path";
import init_errors from "#errors/initErrors";
import { HARNESS_FINGERPRINTS } from "#constants";

export const VALID_HARNESSES = ["claude", "opencode", "pi", "codex"] as const;
export type Harness = (typeof VALID_HARNESSES)[number];

/**
 * Detect active harnesses from fingerprints under `baseDir`.
 *
 * Flow:
 *   1. If a non-empty `harnessFlag` is provided, split on commas, trim,
 *      validate and dedupe, returning the resulting array. Any invalid
 *      token throws `invalid_harness`.
 *   2. Scan fingerprints under `baseDir` (`<baseDir>/.claude`, `<baseDir>/.pi`,
 *      `<baseDir>/.opencode`, `<baseDir>/.codex`). Return all detected harnesses.
 *   3. Nothing found -> throw `no_harness_detected`.
 *
 * Pass `options.baseDir` to override the scanned directory (defaults to home).
 */
export async function detectHarnesses(
  harnessFlag: string | undefined,
  options?: { baseDir?: string },
): Promise<Harness[]> {
  // 1. --harness override (comma-separated)
  if (harnessFlag !== undefined && harnessFlag !== "") {
    const tokens = harnessFlag
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const result: Harness[] = [];

    for (const token of tokens) {
      if (!VALID_HARNESSES.includes(token as Harness)) {
        throw init_errors.invalid_harness(token);
      }
      if (!result.includes(token as Harness)) {
        result.push(token as Harness);
      }
    }

    if (result.length === 0) {
      throw init_errors.no_harness_detected();
    }

    return result;
  }

  // 2. Detection from baseDir fingerprints
  const baseDir = options?.baseDir ?? homedir();
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