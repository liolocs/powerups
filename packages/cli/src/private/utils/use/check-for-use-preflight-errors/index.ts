import use_errors from "#errors/useErrors";
import { Instructions, Step } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";

export default async function checkForUsePreflightErrors({
  cwd,
  instructions,
}: {
  cwd: FileRef;
  instructions: Instructions;
}): Promise<void> {
  await validateSteps({ targetDir: cwd, instructions });
}

async function validateSteps({
  targetDir,
  instructions,
}: {
  targetDir: FileRef;
  instructions: Instructions;
}) {
  // destination files should not exist before creation
  for (const step of instructions.steps) {
    await checkCreateDestinationFilesDoNotExist({ targetDir, step });
    // await checkModifyDestinationFilesExist({ targetDir, step });
  }
}

async function checkCreateDestinationFilesDoNotExist({
  targetDir,
  step,
}: {
  targetDir: FileRef;
  step: Step;
}) {
  if (step.type === "create") {
    const targetPath = targetDir.append(`/${step.outputPath}`);

    if (await targetPath.exists()) {
      throw use_errors.destination_file_exists(step.outputPath);
    }
  }
}