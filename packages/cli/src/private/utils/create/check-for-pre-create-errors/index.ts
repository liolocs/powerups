import type { FileRef } from "@rcompat/fs";
import checkNameWasPassed from "#utils/create/check-for-pre-create-errors/check-name-was-passed";
import checkCaptureFlagValid from "#utils/create/check-for-pre-create-errors/check-capture-flag-valid";
import checkDescriptionWasPassed from "#utils/create/check-for-pre-create-errors/check-description-was-passed";
import checkPowerupDoesNotExist from "#utils/create/check-for-pre-create-errors/check-powerup-does-not-exist";
import checkFolderStructureExists from "#utils/create/check-for-pre-create-errors/check-folder-structure-exists";

export default async function checkForPreCreateErrors({
  powerupName,
  captureValue,
  description,
  isLocal,
  powerupDirectory,
  projectRoot,
  globalRoot,
}: {
  powerupName?: string;
  captureValue?: string;
  description?: string;
  isLocal: boolean;
  powerupDirectory: FileRef;
  projectRoot: FileRef;
  globalRoot: FileRef;
}): Promise<void> {
  checkNameWasPassed(powerupName);

  checkCaptureFlagValid(captureValue);

  checkDescriptionWasPassed(description);

  await checkPowerupDoesNotExist({ powerupDirectory, name: powerupName! });

  await checkFolderStructureExists({ isLocal, projectRoot, globalRoot });
}