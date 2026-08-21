import type { Step } from "@liolocs/powerups-sdk";
import generateStepName from "#utils/create/capture-files/generate-step-name";
import type { GitChange } from "#utils/create/capture-files/git-status";

export default function createStepsFromDeletedFiles({
  deletedFiles,
  existingNames,
}: {
  deletedFiles: GitChange[];
  existingNames: Set<string>;
}): Step[] {
  return deletedFiles.map(change => ({
    type: "delete",
    name: generateStepName({ prefix: "delete", filePath: change.path, existingNames }),
    outputPath: change.path,
  }));
}