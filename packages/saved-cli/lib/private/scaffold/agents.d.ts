import { type FileRef } from "@rcompat/fs";
/**
 * Write the rendered AGENTS.md section to the project root.
 * - If AGENTS.md doesn't exist: create it with the rendered content.
 * - If AGENTS.md has an existing BEGIN/END section: replace it in-place.
 * - If AGENTS.md exists without a section: append the rendered content.
 */
export declare function writeAgentsMd(projectRoot: FileRef, renderedSection: string, cliName: string): Promise<void>;
//# sourceMappingURL=agents.d.ts.map