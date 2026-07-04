import { type FileRef } from "@rcompat/fs";
import { type Harness } from "#scaffold/detect";
export interface ScaffoldResult {
    harness: Harness;
    filesWritten: string[];
}
export interface RollbackInfo {
    remove: string[];
    restore: {
        path: string;
        content: string;
    }[];
}
export declare function scaffold(projectRoot: FileRef, harnessFlag: string | undefined, options?: {
    skipGlobal?: boolean;
    rollback?: RollbackInfo;
}): Promise<ScaffoldResult>;
//# sourceMappingURL=index.d.ts.map