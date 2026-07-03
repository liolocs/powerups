import { type FileRef } from "@rcompat/fs";
export declare const VALID_HARNESSES: readonly ["claude", "opencode", "pi", "codex"];
export type Harness = (typeof VALID_HARNESSES)[number];
/**
 * Detect active harnesses from the project root.
 * If `harnessFlags` is non-empty, use those directly (skip detection).
 * Otherwise check CLAUDE.md, local config dirs, then global config dirs.
 */
export declare function detectHarnesses(projectRoot: FileRef, harnessFlags: string[], options?: {
    skipGlobal?: boolean;
}): Promise<Harness[]>;
//# sourceMappingURL=detect.d.ts.map