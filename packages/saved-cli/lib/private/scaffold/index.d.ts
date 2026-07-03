import { type FileRef } from "@rcompat/fs";
import { type Harness } from "#scaffold/detect";
export interface ScaffoldResult {
    harness: Harness;
    filesWritten: string[];
}
/**
 * Run the full scaffold: detect one harness, render templates, write files.
 */
export declare function scaffold(projectRoot: FileRef, harnessFlag: string | undefined, options?: {
    skipGlobal?: boolean;
}): Promise<ScaffoldResult>;
//# sourceMappingURL=index.d.ts.map