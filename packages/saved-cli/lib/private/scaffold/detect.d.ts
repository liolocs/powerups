import { type FileRef } from "@rcompat/fs";
export declare const VALID_HARNESSES: readonly ["claude", "opencode", "pi", "codex"];
export type Harness = (typeof VALID_HARNESSES)[number];
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
export declare function detectHarness(projectRoot: FileRef, harnessFlag: string | undefined, options?: {
    skipGlobal?: boolean;
}): Promise<Harness>;
//# sourceMappingURL=detect.d.ts.map