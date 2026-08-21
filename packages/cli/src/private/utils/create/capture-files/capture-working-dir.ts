import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import { getGitStatus } from "#utils/create/capture-files/git-status";
import createStepsFromNewFiles from "#utils/create/capture-files/create-steps-from-new-files";
import createStepsFromModifiedFiles from "#utils/create/capture-files/create-steps-from-modified-files";
import createStepsFromDeletedFiles from "#utils/create/capture-files/create-steps-from-deleted-files";

export default async function captureWorkingDir({
  projectRoot,
  workingDir,
  newPowerupDirectory,
  isDryRun,
}: {
  projectRoot: FileRef;
  workingDir: FileRef;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<{ steps: Step[]; fileCount: number; warnings: string[] }> {
  const changes = await getGitStatus({ workingDir, projectRoot });

  if (changes.length === 0) {
    return { steps: [], fileCount: 0, warnings: [`No git changes detected in ${workingDir.path}`] };
  }

  const existingNames = new Set<string>();
  const warnings: string[] = [];

  const newFiles = changes.filter(c => c.status === "new").sort((a, b) => a.path.localeCompare(b.path));
  const modifiedFiles = changes.filter(c => c.status === "modified").sort((a, b) => a.path.localeCompare(b.path));
  const deletedFiles = changes.filter(c => c.status === "deleted").sort((a, b) => a.path.localeCompare(b.path));
  const renamedFiles = changes.filter(c => c.status === "renamed" || c.status === "unknown");

  const createSteps = await createStepsFromNewFiles({
    newFiles,
    projectRoot,
    newPowerupDirectory,
    existingNames,
    isDryRun,
  });

  const modifySteps = await createStepsFromModifiedFiles({
    modifiedFiles,
    projectRoot,
    newPowerupDirectory,
    existingNames,
    warnings,
    isDryRun,
  });

  const deleteSteps = createStepsFromDeletedFiles({ deletedFiles, existingNames });

  for (const change of renamedFiles) {
    warnings.push(`Renamed or unknown change: ${change.path} (${change.rawStatus}) — requires manual review, not included`);
  }

  const steps = [...createSteps, ...modifySteps, ...deleteSteps];

  return { steps, fileCount: changes.length, warnings };
}