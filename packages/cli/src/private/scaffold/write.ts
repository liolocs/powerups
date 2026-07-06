import fs, { type FileRef } from "@rcompat/fs";

interface WriteOptions {
  frontmatter?: string;
}

/**
 * Write a rendered command file to the project root.
 * Creates parent directories as needed.
 * If frontmatter is provided, prepends it as YAML frontmatter.
 */
export async function writeCommandFile(
  projectRoot: FileRef,
  relativePath: string,
  content: string,
  options?: WriteOptions,
): Promise<void> {
  const targetPath = projectRoot.append(`/${relativePath}`);

  // Create parent directories
  await fs.create(targetPath.directory);

  // Prepend frontmatter if provided
  const finalContent = options?.frontmatter
    ? `---\n${options.frontmatter}\n---\n${content}`
    : content;

  await targetPath.write(finalContent);
}