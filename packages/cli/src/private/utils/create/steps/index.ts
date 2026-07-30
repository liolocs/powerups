import type { Instructions, Step } from "#schemas/instruction";
import { getGitStatus } from "#utils/create/git/git-status";
import type { FileRef } from "@rcompat/fs";
import { extractDepsFromPackageChanges } from "#utils/create/steps/extract-deps-from-package-changes";
import { createStepFromModifiedFile } from "#utils/create/steps/create-step-from-modified-file";
import { createStepFromNewFile } from "#utils/create/steps/create-step-from-new-file";
import { createStepFromDeletedFile } from "#utils/create/steps/create-step-from-deleted-file";

export async function createStepsFromWorkingDir({
  workingDir,
  projectRoot,
  outputFolder,
  packageDependencies,
}: {
  projectRoot: FileRef;
  workingDir: FileRef;
  outputFolder: FileRef;
  packageDependencies: Instructions["packageDependencies"];
}) {
  let newFileCount = 0;
  let modifiedFileCount = 0;
  let deletedFileCount = 0;
  let steps: Step[] = [];

  const warnings: string[] = [];
  const changes = await getGitStatus({ workingDir, projectRoot });

  if (changes.length === 0) {
    warnings.push(`No git changes detected in ${workingDir.path}`);
  } else {
    const existingNames = new Set<string>();

    const newFiles = changes.filter(c => c.status === "new").sort((a, b) => a.path.localeCompare(b.path));
    const modifiedFiles = changes.filter(c => c.status === "modified").sort((a, b) => a.path.localeCompare(b.path));
    const deletedFiles = changes.filter(c => c.status === "deleted").sort((a, b) => a.path.localeCompare(b.path));
    const renamedFiles = changes.filter(c => c.status === "renamed" || c.status === "unknown");

    const createSteps: Step[] = [];

    for (const change of newFiles) {
      const newFileStep = await createStepFromNewFile({
        change,
        projectRoot,
        outputFolder,
        existingNames,
      });

      createSteps.push(newFileStep);
    }

    newFileCount = newFiles.length;

    const modifySteps: Step[] = [];

    for (const change of modifiedFiles) {
      const result = await extractDepsFromPackageChanges({
        change,
        projectRoot,
      });

      warnings.push(...result.warnings);

      if (packageDependencies === undefined) {
        packageDependencies = [];
      }

      packageDependencies.push(...result.packageDependencies);

      const step = await createStepFromModifiedFile({
        change,
        projectRoot,
        outputFolder,
        existingNames,
        warnings,
      });
      if (step !== null) {
        modifySteps.push(step);
      }
    }
    modifiedFileCount = modifiedFiles.length;

    const deleteSteps: Step[] = deletedFiles.map(change =>
      createStepFromDeletedFile({ change, existingNames }),
    );
    deletedFileCount = deletedFiles.length;

    for (const change of renamedFiles) {
      warnings.push(`Renamed or unknown change: ${change.path} (${change.rawStatus}) — requires manual review, not included`);
    }

    steps = [...createSteps, ...modifySteps, ...deleteSteps];
  }

  return {
    newFileCount,
    modifiedFileCount,
    deletedFileCount,
    warnings,
    steps,
  };
}