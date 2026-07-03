import fs, { type FileRef } from "@rcompat/fs";

/**
 * Write the rendered instruction section to a file (AGENTS.md or CLAUDE.md).
 * - If the file doesn't exist: create it with the rendered content.
 * - If the file has an existing BEGIN/END section: replace it in-place.
 * - If the file exists without a section: append the rendered content.
 */
export async function writeInstructionFile(
  projectRoot: FileRef,
  filename: string,
  renderedSection: string,
  cliName: string,
): Promise<void> {
  const filePath = projectRoot.append(`/${filename}`);
  const beginMarker = `<!-- BEGIN ${cliName} -->`;
  const endMarker = `<!-- END ${cliName} -->`;

  if (!(await fs.exists(filePath))) {
    // Create new file
    await filePath.write(renderedSection);
    return;
  }

  const existing = await filePath.text();

  // Check for existing section
  const beginIdx = existing.indexOf(beginMarker);
  if (beginIdx !== -1) {
    const endIdx = existing.indexOf(endMarker, beginIdx);
    if (endIdx !== -1) {
      // Replace the existing section in-place
      const before = existing.substring(0, beginIdx);
      const after = existing.substring(endIdx + endMarker.length);
      await filePath.write(before + renderedSection + after);
      return;
    }
  }

  // Append to existing file
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  await filePath.write(existing + separator + renderedSection);
}