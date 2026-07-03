import fs, { type FileRef } from "@rcompat/fs";
import { homedir } from "node:os";
import path from "node:path";
import init_errors from "#errors/initErrors";

export const VALID_HARNESSES = ["claude", "opencode", "pi", "codex"] as const;
export type Harness = (typeof VALID_HARNESSES)[number];

const HOME = homedir();

/**
 * Detect active harnesses from the project root.
 * If `harnessFlags` is non-empty, use those directly (skip detection).
 * Otherwise check CLAUDE.md, local config dirs, then global config dirs.
 */
export async function detectHarnesses(
  projectRoot: FileRef,
  harnessFlags: string[],
  options?: { skipGlobal?: boolean },
): Promise<Harness[]> {
  // 1. --harness override
  if (harnessFlags.length > 0) {
    const harnesses: Harness[] = [];
    for (const h of harnessFlags) {
      if (!VALID_HARNESSES.includes(h as Harness)) {
        throw init_errors.invalid_harness(h);
      }
      harnesses.push(h as Harness);
    }
    return harnesses;
  }

  // 2. CLAUDE.md at root → claude
  const harnesses = new Set<Harness>();
  const claudeMd = projectRoot.append("/CLAUDE.md");
  if (await fs.exists(claudeMd)) {
    harnesses.add("claude");
  }

  // 3. Local config dirs
  if (await fs.exists(projectRoot.append("/.claude"))) {
    harnesses.add("claude");
  }
  if (await fs.exists(projectRoot.append("/.opencode"))) {
    harnesses.add("opencode");
  }
  if (await fs.exists(projectRoot.append("/.pi"))) {
    harnesses.add("pi");
  }

  // 4. Global config dirs (skip in tests with options.skipGlobal)
  if (options?.skipGlobal !== true) {
    if (await fs.exists(fs.ref(path.join(HOME, ".claude")))) {
      harnesses.add("claude");
    }
    if (await fs.exists(fs.ref(path.join(HOME, ".pi", "agent")))) {
      harnesses.add("pi");
    }
    if (await fs.exists(fs.ref(path.join(HOME, ".config", "opencode")))) {
      harnesses.add("opencode");
    }
  }

  return [...harnesses];
}