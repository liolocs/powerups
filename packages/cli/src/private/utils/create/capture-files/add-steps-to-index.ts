import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { Step } from "@liolocs/powerups-sdk";

export default async function addStepsToIndex({
  indexFilePath,
  steps,
}: {
  indexFilePath: FileRef;
  steps: Step[];
}): Promise<void> {
  const content = await indexFilePath.text();
  const stepsJson = JSON.stringify(steps, null, 2);

  const updatedContent = content.replace("steps: []", `steps: ${stepsJson}`);

  await indexFilePath.write(updatedContent);
}