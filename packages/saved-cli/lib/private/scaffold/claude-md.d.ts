import { type FileRef } from "@rcompat/fs";
/**
 * Create CLAUDE.md as a symlink to AGENTS.md.
 * If CLAUDE.md already exists as a symlink to AGENTS.md, skip.
 * If CLAUDE.md exists as a regular file, throw.
 * If symlink creation fails (e.g. Windows), fall back to @AGENTS.md import.
 */
export declare function linkClaudeMd(projectRoot: FileRef): Promise<void>;
//# sourceMappingURL=claude-md.d.ts.map