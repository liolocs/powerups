import fs from "@rcompat/fs";
/**
 * Write the rendered AGENTS.md section to the project root.
 * - If AGENTS.md doesn't exist: create it with the rendered content.
 * - If AGENTS.md has an existing BEGIN/END section: replace it in-place.
 * - If AGENTS.md exists without a section: append the rendered content.
 */
export async function writeAgentsMd(projectRoot, renderedSection, cliName) {
    const agentsPath = projectRoot.append("/AGENTS.md");
    const beginMarker = `<!-- BEGIN ${cliName} -->`;
    const endMarker = `<!-- END ${cliName} -->`;
    if (!(await fs.exists(agentsPath))) {
        // Create new file
        await agentsPath.write(renderedSection);
        return;
    }
    const existing = await agentsPath.text();
    // Check for existing section
    const beginIdx = existing.indexOf(beginMarker);
    if (beginIdx !== -1) {
        const endIdx = existing.indexOf(endMarker, beginIdx);
        if (endIdx !== -1) {
            // Replace the existing section in-place
            const before = existing.substring(0, beginIdx);
            const after = existing.substring(endIdx + endMarker.length);
            const newContent = before + renderedSection + after;
            await agentsPath.write(newContent);
            return;
        }
    }
    // Append to existing file
    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    await agentsPath.write(existing + separator + renderedSection);
}
//# sourceMappingURL=agents.js.map