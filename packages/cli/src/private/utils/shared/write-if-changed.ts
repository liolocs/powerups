import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export default async function writeIfChanged({
  targetPath,
  content,
}: {
  targetPath: FileRef;
  content: string;
}): Promise<boolean> {
  if (await targetPath.exists()) {
    const existing = await targetPath.text();
    const normalizedContent = content.endsWith("\n") ? content : `${content}\n`;
    if (existing === normalizedContent) {
      return false;
    }
  }

  await fs.create(targetPath.directory);
  await targetPath.write(content);

  return true;
}