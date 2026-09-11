import { type Flag } from "@liolocs/program";
import { type FileRef } from "@rcompat/fs";
import { type Instructions } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/use/resolved-variable";

import init_errors from "#errors/initErrors";
import {
  CLI_CMD,
  CLI_FOLDER_NAME,
  INTERNAL_FOLDER,
  SINGULAR_NAME_FOR_CLI,
  VALID_HARNESSES,
  type Harness,
} from "#constants";
import getBuiltInPowerup from "#utils/use/get-powerup/getBuiltInPowerup";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";

export const dryRunFlag = {
  name: "dryRun", long: "dry-run", short: "dr",
  description: "Print output to stdout instead of writing files",
  type: "boolean",
} as const satisfies Flag;

export function parseHarness({ subcommands }: {
  subcommands?: string[];
}): Harness {
  const harness = subcommands?.[0];

  if (harness === undefined) {
    throw init_errors.missing_harness();
  }

  if (!VALID_HARNESSES.includes(harness as Harness)) {
    throw init_errors.invalid_harness(harness);
  }

  return harness as Harness;
}

export function buildSkillVariables(): ResolvedVariable {
  return {
    CLI_CMD,
    CLI_FOLDER_NAME,
    INTERNAL_FOLDER,
    SINGULAR_NAME_FOR_CLI,
  };
}

export async function loadHarnessSkills(): Promise<{
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