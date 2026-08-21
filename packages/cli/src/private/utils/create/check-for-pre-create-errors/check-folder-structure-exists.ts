import create_errors from "#errors/createErrors";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export default async function checkFolderStructureExists({
  isLocal,
  projectRoot,
  globalRoot,
}: {
  isLocal: boolean;
  projectRoot: FileRef;
  globalRoot: FileRef;
}): Promise<void> {
  if (isLocal) {
    const powerupsFolder = projectRoot.append("/.powerups");

    if (!(await fs.exists(powerupsFolder))) {
      throw create_errors.main_folder_not_found();
    }
  } else {
    if (!(await fs.exists(globalRoot))) {
      throw create_errors.global_root_not_found();
    }
  }
}