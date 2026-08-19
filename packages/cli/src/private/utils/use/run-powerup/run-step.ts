import type { CreateStep, InstallStep, ManifestEntry, Step } from "@liolocs/powerups-sdk";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step/index";
import runCreateStep from "#utils/use/run-powerup/steps/run-create-step/index";
import is from "@rcompat/is";
import { type FileRef } from "@rcompat/fs";
import use_errors from "#errors/useErrors";

export type StepRunArgs = {
  step: Step;
  isDryRun: boolean;
  destination: FileRef;
  powerupDir: FileRef;
};

export type BaseManifestProperties = "powerupName" | "version" | "location" | "type";

type StepRunner<S extends Step> = (args: { step: S; isDryRun: boolean; destination: FileRef; powerupDir: FileRef }) => Promise<Omit<ManifestEntry, BaseManifestProperties>>;

const stepTypes: Partial<{ [K in Step["type"]]: StepRunner<Extract<Step, { type: K }>> }> = {
  create: runCreateStep,
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
    step: InstallStep | CreateStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDir: FileRef;
  }): Promise<Omit<ManifestEntry, BaseManifestProperties>> {
  const stepType = step.type;
  const runStepFn = stepTypes[stepType];

  if (is.truthy(runStep)) {
    return runStepFn!({ step, isDryRun, destination, powerupDir });
  } else {
    throw use_errors.unsupported_step_type(step.type);
  }
}