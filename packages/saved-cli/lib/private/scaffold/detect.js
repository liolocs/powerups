import fs from "@rcompat/fs";
import { homedir } from "node:os";
import path from "node:path";
import init_errors from "#errors/initErrors";
export const VALID_HARNESSES = ["claude", "opencode", "pi", "codex"];
const HOME = homedir();
/**
 * Detect a single active harness from the project root.
 *
 * Flow:
 *   1. If harnessFlag is provided, validate and return it (skip detection).
 *   2. Check local fingerprints (CLAUDE.md, .claude/, .opencode/, .pi/).
 *      - Exactly 1  → return it.
 *      - More than 1 → throw multiple_harnesses_detected.
 *   3. Check global fingerprints (~/.claude/, ~/.pi/agent/, ~/.config/opencode/).
 *      - Exactly 1  → return it.
 *      - More than 1 → throw multiple_harnesses_detected.
 *   4. Nothing found → throw no_harness_detected.
 */
export async function detectHarness(projectRoot, harnessFlag, options) {
    // 1. --harness override
    if (harnessFlag !== undefined) {
        if (!VALID_HARNESSES.includes(harnessFlag)) {
            throw init_errors.invalid_harness(harnessFlag);
        }
        return harnessFlag;
    }
    // 2. Local detection
    const localFound = new Set();
    if (await fs.exists(projectRoot.append("/CLAUDE.md")))
        localFound.add("claude");
    if (await fs.exists(projectRoot.append("/.claude")))
        localFound.add("claude");
    if (await fs.exists(projectRoot.append("/.opencode")))
        localFound.add("opencode");
    if (await fs.exists(projectRoot.append("/.pi")))
        localFound.add("pi");
    if (localFound.size === 1)
        return [...localFound][0];
    if (localFound.size > 1) {
        throw init_errors.multiple_harnesses_detected([...localFound]);
    }
    // 3. Global detection (only if nothing found locally)
    if (options?.skipGlobal) {
        throw init_errors.no_harness_detected();
    }
    const globalFound = new Set();
    if (await fs.exists(fs.ref(path.join(HOME, ".claude"))))
        globalFound.add("claude");
    if (await fs.exists(fs.ref(path.join(HOME, ".pi", "agent"))))
        globalFound.add("pi");
    if (await fs.exists(fs.ref(path.join(HOME, ".config", "opencode"))))
        globalFound.add("opencode");
    if (globalFound.size === 1)
        return [...globalFound][0];
    if (globalFound.size > 1) {
        throw init_errors.multiple_harnesses_detected([...globalFound]);
    }
    // 4. Nothing found
    throw init_errors.no_harness_detected();
}
//# sourceMappingURL=detect.js.map