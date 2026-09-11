import { type FileRef } from "@rcompat/fs";
import { type Instructions } from "@liolocs/powerups-sdk";

import getBuiltInPowerup from "#utils/use/get-powerup/getBuiltInPowerup";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";

export default async function loadHarnessSkills(): Promise<{
  instructions: Instructions;
  location: FileRef;
  version: string;
}> {
  const powerup = await getBuiltInPowerup({ name: "harness-skills" });

  const { validatedCompiledInstructions } =
    await checkCompiledInstructionsForErrors(powerup.instructions);

  return {
    instructions: validatedCompiledInstructions,
    location: powerup.location,
    version: powerup.version,
  };
}