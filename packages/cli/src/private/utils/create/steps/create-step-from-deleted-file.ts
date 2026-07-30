import type { Step } from "#schemas/instruction";
import type { GitChange } from "#utils/create/git/git-status";
import { generateStepName } from "#utils/create/steps/generate-step-name";

export function createStepFromDeletedFile({
  change,
  existingNames,
}: {
  change: GitChange;
  existingNames: Set<string>;
}): Step {
  const stepName = generateStepName({
    prefix: "delete",
    filePath: change.path,
    existingNames,
  });

  return {
    type: "delete",
    name: stepName,
    outputPath: change.path,
  };
}