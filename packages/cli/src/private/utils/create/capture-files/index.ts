import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import captureAllFiles from "#utils/create/capture-files/capture-all-files";
import captureWorkingDir from "#utils/create/capture-files/capture-working-dir";
import addStepsToIndex from "#utils/create/capture-files/add-steps-to-index";

export type CaptureResult = {
  steps: Step[];
  fileCount: number;
  warnings: string[];
};

export default async function captureFiles({
  captureMode,
  projectRoot,
  workingDir,
  newPowerupDirectory,
  indexFilePath,
  isDryRun,
}: {
  captureMode: "all" | "workingDir";
  projectRoot: FileRef;
  workingDir: FileRef;
  newPowerupDirectory: FileRef;
  indexFilePath: FileRef;
  isDryRun: boolean;
}): Promise<CaptureResult> {
  let result: CaptureResult;

  if (captureMode === "all") {
    result = await captureAllFiles({ projectRoot, newPowerupDirectory, isDryRun });
  } else {
    result = await captureWorkingDir({ projectRoot, workingDir, newPowerupDirectory, isDryRun });
  }

  if (!isDryRun && result.steps.length > 0) {
    await addStepsToIndex({ indexFilePath, steps: result.steps });
  }

  return result;
}