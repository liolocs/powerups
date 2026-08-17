import { type FileRef } from "@rcompat/fs";
import checkNameForPowerupWasPassed from "#utils/use/check-for-pre-use-errors/check-name-for-powerup-was-passed";
import checkForCleanGitState from "#utils/use/check-for-pre-use-errors/check-for-clean-git-state";

export default async function checkForPreUseErrors({
  cwd,
  powerupName,
}: {
  cwd: FileRef;
    powerupName?: string;
}): Promise<void> {
  await checkNameForPowerupWasPassed(powerupName);

  await checkForCleanGitState(cwd);
}