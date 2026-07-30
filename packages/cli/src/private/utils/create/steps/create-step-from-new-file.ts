import type { Step } from "#schemas/instruction";
import type { GitChange } from "#utils/create/git/git-status";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import { wrapAsTemplate } from "#utils/create/steps/wrap-as-template";
import { generateStepName } from "#utils/create/steps/generate-step-name";

export async function createStepFromNewFile({
  change,
  projectRoot,
  outputFolder,
  existingNames,
}: {
  change: GitChange;
  projectRoot: FileRef;
  outputFolder: FileRef;
  existingNames: Set<string>;
}): Promise<Step> {
  const sourcePath = projectRoot.append(`/${change.path}`);
  const content = await sourcePath.text();

  const templateContent = wrapAsTemplate(content);
  const templatePath = outputFolder.append(`/src/${change.path}.ts`);

  await fs.create(templatePath.directory);
  await templatePath.write(templateContent);

  const stepName = generateStepName({
    prefix: "create",
    filePath: change.path,
    existingNames,
  });

  return {
    type: "create",
    name: stepName,
    template: `src/${change.path}.ts.ts`,
    outputPath: change.path,
  };
}