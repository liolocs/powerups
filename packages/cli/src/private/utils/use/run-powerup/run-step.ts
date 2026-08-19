import type { CreateStep, InstallStep, ManifestEntry, Step } from "@liolocs/powerups-sdk";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step/index";
import runCreateStep from "#utils/use/run-powerup/steps/run-create-step/index";
import is from "@rcompat/is";
import { type FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import use_errors from "#errors/useErrors";
import { resolveStepVariables } from "#utils/use/run-powerup/resolve-step-variables";

export type StepRunArgs = {
  step: Step;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
};

export type BaseManifestProperties = "powerupName" | "version" | "location" | "type";

type StepRunner<S extends Step> = (args: {
  step: S;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}) => Promise<Omit<ManifestEntry, BaseManifestProperties>>;

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
  powerupDirectory,
  variables,
}: {
  step: InstallStep | CreateStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<Omit<ManifestEntry, BaseManifestProperties>> {
  const stepType = step.type;
  const runStepFunction = stepTypes[stepType];

  if (is.truthy(runStepFunction)) {
    const stepVariables = resolveStepVariables({ step, variables });

    return runStepFunction!({
      step,
      isDryRun,
      destination,
      powerupDirectory,
      variables: stepVariables,
    });
  } else {
    throw use_errors.unsupported_step_type(step.type);
  }
}