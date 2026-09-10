import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import generateStepName from "#utils/create/capture-files/generate-step-name";
import type { GitChange } from "#utils/create/capture-files/git-status";

export default async function createStepsFromNewFiles({
  newFiles,
  projectRoot,
  newPowerupDirectory,
  existingNames,
  isDryRun,
}: {
  newFiles: GitChange[];
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  existingNames: Set<string>;
  isDryRun: boolean;
}): Promise<Step[]> {
  const steps: Step[] = [];

  for (const change of newFiles) {
    const sourceRef = projectRoot.append(`/${change.path}`);
    const fileField = `src/create/${change.path}`;

    if (!isDryRun) {
      const targetRef = newPowerupDirectory.append(`/${fileField}`);
      await fs.create(targetRef.directory);
      await sourceRef.copy(targetRef);
    }

    const stepName = generateStepName({ prefix: "create", filePath: change.path, existingNames });

    steps.push({ type: "create", name: stepName, file: fileField, outputPath: change.path });
  }

  return steps;
}