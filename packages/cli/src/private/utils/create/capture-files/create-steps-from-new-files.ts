import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import wrapAsTemplate from "#utils/create/capture-files/wrap-as-template";
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
    const sourcePath = projectRoot.append(`/${change.path}`);
    const content = await sourcePath.text();
    const templateContent = wrapAsTemplate(content);
    const templatePath = `templates/${change.path}.ts`;

    if (!isDryRun) {
      const templateFileRef = newPowerupDirectory.append(`/${templatePath}`);
      await fs.create(templateFileRef.directory);
      await templateFileRef.write(templateContent);
    }

    const stepName = generateStepName({ prefix: "create", filePath: change.path, existingNames });

    steps.push({ type: "create", name: stepName, template: templatePath, outputPath: change.path });
  }

  return steps;
}