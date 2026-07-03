import { type FileRef } from "@rcompat/fs";
import { type Harness } from "#scaffold/detect";
export interface ScaffoldResult {
    harnesses: Harness[];
    filesWritten: string[];
}
/**
 * Run the full scaffold: detect harnesses, render templates, write files.
 */
export declare function scaffold(projectRoot: FileRef, harnessFlags: string[], options?: {
    skipGlobal?: boolean;
}): Promise<ScaffoldResult>;
//# sourceMappingURL=index.d.ts.map