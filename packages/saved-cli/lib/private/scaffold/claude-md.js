import fs from "@rcompat/fs";
import init_errors from "#errors/initErrors";
/**
 * Create CLAUDE.md as a symlink to AGENTS.md.
 * If CLAUDE.md already exists as a symlink to AGENTS.md, skip.
 * If CLAUDE.md exists as a regular file, throw.
 * If symlink creation fails (e.g. Windows), fall back to @AGENTS.md import.
 */
export async function linkClaudeMd(projectRoot) {
    const claudeMd = projectRoot.append("/CLAUDE.md");
    if (await fs.exists(claudeMd)) {
        // Check if it's already a symlink
        try {
            const { lstat } = await import("node:fs/promises");
            const stat = await lstat(claudeMd.path);
            if (stat.isSymbolicLink()) {
                return; // Already a symlink, skip
            }
        }
        catch {
            // Can't stat, fall through to error
        }
        throw init_errors.claude_md_exists_not_symlink();
    }
    // Try to create symlink
    try {
        const { symlink } = await import("node:fs/promises");
        await symlink("AGENTS.md", claudeMd.path);
    }
    catch {
        // Fallback: write @AGENTS.md import
        await claudeMd.write("@AGENTS.md");
    }
}
//# sourceMappingURL=claude-md.js.map