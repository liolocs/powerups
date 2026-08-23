import { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";

export default async function getRoot({
  cwd,
  contextRoot,
  targetDir,
}: {
  cwd: FileRef;
  contextRoot?: FileRef;
  targetDir?: string;
}): Promise<FileRef> {
  if(is.defined(contextRoot)) {
    return contextRoot;
  }

  if (is.defined(targetDir)) {
    // remove preceding slash and dotslash
    const dir = targetDir.replace(/^\.?\//, "");
    return cwd.append(`/${dir}`);
  }

  return cwd;
}