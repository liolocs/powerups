import type { Instructions, Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";

export default async function createInstructionsJSONFile({
  validatedCompiledInstructions,
  outputFolderRef,
}: {
  validatedCompiledInstructions: Instructions;
  outputFolderRef: FileRef;
}) {
  const serializable = {
    ...validatedCompiledInstructions,
    steps: stripSourcePropertyFromSteps(validatedCompiledInstructions.steps),
  };

  await outputFolderRef.append("/instructions.json").writeJSON(serializable);
}

function stripSourcePropertyFromSteps(steps: Step[]): Step[] {
  return steps.map(step => {
    const { __source: _omit, ...rest } = step as Step & { __source?: string };

    return rest as Step;
  });
}