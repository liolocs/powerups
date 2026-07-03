import fs, { type FileRef } from "@rcompat/fs";

/**
 * Write the rendered instruction section to a file (AGENTS.md or CLAUDE.md).
 * - If the file doesn't exist: create it with the rendered content.
 * - If the file has an existing BEGIN/END section: replace it in-place.
 * - If the file exists without a section: append the rendered content.
 *
 * Returns `true` if the file was newly created, `false` if an existing file
 * was modified (needed for rollback tracking).
 */
export async function writeToAgentsOrClaudeMD(
  projectRoot: FileRef,
  filename: string,
  renderedSection: string,
  cliName: string,
): Promise<boolean> {
  const filePath = projectRoot.append(`/${filename}`);
  const beginMarker = `<!-- BEGIN ${cliName} -->`;
  const endMarker = `<!-- END ${cliName} -->`;

  if (!(await fs.exists(filePath))) {
    await filePath.write(renderedSection);
    return true;
  }

  const existing = await filePath.text();

  // Check for existing section
  const beginningIndex = existing.indexOf(beginMarker);
  if (beginningIndex !== -1) {
    const endingIndex = existing.indexOf(endMarker, beginningIndex);
    if (endingIndex !== -1) {
      // Replace the existing section in-place
      const before = existing.substring(0, beginningIndex);
      const after = existing.substring(endingIndex + endMarker.length);
      await filePath.write(before + renderedSection + after);
      return false;
    }
  }

  const separator = existing.endsWith("\n") ? "\n" : "\n\n";

  await filePath.write(existing + separator + renderedSection);
  return false;
}