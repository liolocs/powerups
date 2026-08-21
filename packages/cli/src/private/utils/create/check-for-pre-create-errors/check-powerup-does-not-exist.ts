import create_errors from "#errors/createErrors";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export default async function checkPowerupDoesNotExist({
  powerupDirectory,
  name,
}: {
  powerupDirectory: FileRef;
  name: string;
}): Promise<void> {
  const targetPath = powerupDirectory.append(`/${name}`);

  if (await fs.exists(targetPath)) {
    throw create_errors.already_exists(name);
  }
}