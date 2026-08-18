import { type FileRef } from "@rcompat/fs";
import checkNameForPowerupWasPassed from "#utils/use/check-for-pre-use-errors/check-name-for-powerup-was-passed";
import checkForCleanGitState from "#utils/use/check-for-pre-use-errors/check-for-clean-git-state";
import checkForPowerupInConfig from "#utils/use/check-for-pre-use-errors/check-for-powerup-in-config/index";
import { GLOBAL_ROOT } from "#constants";
import fs from "@rcompat/fs";

export default async function checkForPreUseErrors({
  cwd,
  powerupName,
}: {
  cwd: FileRef;
  powerupName?: string;
  }): Promise<void> {
  checkNameForPowerupWasPassed(powerupName);

  await checkForPowerupInConfig({ cwd, powerupName, globalRoot: fs.ref(GLOBAL_ROOT) });

  await checkForCleanGitState(cwd);
}