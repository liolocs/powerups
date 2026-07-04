import { type FileRef } from "@rcompat/fs";
/**
 * Write the rendered instruction section to a file (AGENTS.md or CLAUDE.md).
 * - If the file doesn't exist: create it with the rendered content.
 * - If the file has an existing BEGIN/END section: replace it in-place.
 * - If the file exists without a section: append the rendered content.
 *
 * Returns `true` if the file was newly created, `false` if an existing file
 * was modified (needed for rollback tracking).
 */
export declare function writeToAgentsOrClaudeMD(projectRoot: FileRef, filename: string, renderedSection: string, cliName: string): Promise<boolean>;
//# sourceMappingURL=agents.d.ts.map