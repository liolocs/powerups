import fs, { type FileRef } from "@rcompat/fs";

/**
 * Write a rendered skill file to the project root.
 * Creates parent directories as needed.
 *
 * Skill files carry their own YAML frontmatter (name + description) in the
 * rendered template, so no frontmatter injection is performed here — the
 * content is written verbatim.
 */
export async function writeSkillFile(
  projectRoot: FileRef,
  relativePath: string,
  content: string,
): Promise<void> {
  const targetPath = projectRoot.append(`/${relativePath}`);

  // Create parent directories
  await fs.create(targetPath.directory);

  await targetPath.write(content);
}