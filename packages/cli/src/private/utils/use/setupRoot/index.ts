import { type FileRef } from "@rcompat/fs";
import getRoot from "#utils/use/setupRoot/getRoot";

export default async function setupRoot({
  contextRoot,
  cwd,
  targetDir,
}: {
  contextRoot?: FileRef;
  cwd: FileRef;
  targetDir?: string;
}): Promise<FileRef> {
  const root = await getRoot({
    cwd,
    contextRoot,
    targetDir,
  });

  if(!(await root.exists())) {
    await root.create();
  }

  return root;
}