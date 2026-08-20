import type { CreateStep, DeleteStep, InstallStep, ManifestEntry, ModifyStep, ReadStep, Step } from "@liolocs/powerups-sdk";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step/index";
import runCreateStep from "#utils/use/run-powerup/steps/run-create-step/index";
import runModifyStep from "#utils/use/run-powerup/steps/run-modify-step/index";
import runReadStep from "#utils/use/run-powerup/steps/run-read-step/index";
import runDeleteStep from "#utils/use/run-powerup/steps/run-delete-step/index";
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

export type StepRunnerResult = {
  manifest: Omit<ManifestEntry, BaseManifestProperties>;
  variableUpdate?: { name: string; value: string };
};

type StepRunner<S extends Step> = (args: {
  step: S;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}) => Promise<StepRunnerResult>;

const stepTypes: Partial<{ [K in Step["type"]]: StepRunner<Extract<Step, { type: K }>> }> = {
  create: runCreateStep,
  modify: runModifyStep,
  delete: runDeleteStep,
  read: runReadStep,
  install: runInstallStep,
};

export default async function runStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
}: {
  step: InstallStep | CreateStep | ModifyStep | ReadStep | DeleteStep;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
}): Promise<StepRunnerResult> {
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