import fs from "@rcompat/fs";
/**
 * Write a rendered command file to the project root.
 * Creates parent directories as needed.
 * If frontmatter is provided, prepends it as YAML frontmatter.
 */
export async function writeCommandFile(projectRoot, relativePath, content, options) {
    const targetPath = projectRoot.append(`/${relativePath}`);
    // Create parent directories
    await fs.create(targetPath.directory);
    // Prepend frontmatter if provided
    const finalContent = options?.frontmatter
        ? `---\n${options.frontmatter}\n---\n${content}`
        : content;
    await targetPath.write(finalContent);
}
//# sourceMappingURL=write.js.map