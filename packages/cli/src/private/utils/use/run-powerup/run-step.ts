import type { ManifestEntry, Step } from "@liolocs/powerups-sdk";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step";
import is from "@rcompat/is";
import { type FileRef } from "@rcompat/fs";
import use_errors from "#errors/useErrors";

export type StepRunArgs = {
  step: Step;
  isDryRun: boolean;
  destination: FileRef;
  powerupDir: FileRef;
};

const stepTypes: Record<Step["type"], (args: StepRunArgs) => Promise<ManifestEntry>> = {
  // create: runCreateStep,
  // modify: runModifyStep,
  // delete: runDeleteStep,
  // read: runReadStep,
  install: runInstallStep,
};

export default async function runStep({
  step,
  isDryRun,
  destination,
  powerupDir,
}: {
  step: Step;
  isDryRun: boolean;
  destination: FileRef;
  powerupDir: FileRef;
  }): Promise<ManifestEntry> {
  const stepType = step.type;
  const runStepFn = stepTypes[stepType];

  if (is.truthy(runStep)) {
    return runStepFn({ step, isDryRun, destination, powerupDir });
  } else {
    throw use_errors.unsupported_step_type(step.type);
  }
}