import type { ManifestEntry, Step } from "@liolocs/powerups-sdk";
import runInstallStep from "#utils/use/run-powerup/steps/run-install-step/index";
import runCreateStep from "#utils/use/run-powerup/steps/run-create-step/index";
import runModifyStep from "#utils/use/run-powerup/steps/run-modify-step/index";
import runReadStep from "#utils/use/run-powerup/steps/run-read-step/index";
import runDeleteStep from "#utils/use/run-powerup/steps/run-delete-step/index";
import { type FileRef } from "@rcompat/fs";
import type { ResolvedVariable } from "#utils/variables";
import use_errors from "#errors/useErrors";
import { resolveStepVariables } from "#utils/use/run-powerup/resolve-step-variables";

export type BaseManifestProperties = "powerupName" | "version" | "location" | "type";

export type StepRunnerResult = {
  manifest: ManifestEntry;
  variableUpdate?: { name: string; value: string };
};

export default async function runStep({
  step,
  isDryRun,
  destination,
  powerupDirectory,
  variables,
  powerupName,
  powerupVersion,
  powerupLocation,
  powerupType,
}: {
  step: Step;
  isDryRun: boolean;
  destination: FileRef;
  powerupDirectory: FileRef;
  variables: ResolvedVariable;
  powerupName: string;
  powerupVersion: string;
  powerupLocation: string;
  powerupType: "multi-use" | "single-use";
}): Promise<StepRunnerResult> {
  const stepVariables = resolveStepVariables({ step, variables });

  const base = {
    powerupName,
    version: powerupVersion,
    location: powerupLocation,
    type: powerupType,
  };

  switch (step.type) {
    case "create": {
      const result = await runCreateStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
      };
    }
    case "modify": {
      const result = await runModifyStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
      };
    }
    case "delete": {
      const result = await runDeleteStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
      };
    }
    case "read": {
      const result = await runReadStep({
        step, isDryRun, destination, powerupDirectory, variables: stepVariables,
      });

      return {
        manifest: { ...result.manifest, ...base },
        variableUpdate: result.variableUpdate,
      };
    }
    case "install": {
      const result = await runInstallStep({
        step, isDryRun, destination,
      });

      return {
        manifest: { ...result.manifest, ...base },
      };
    }
    default:
      throw use_errors.unsupported_step_type((step as { type: string }).type);
  }
}