import { powerupPropertySchema } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import { SINGULAR_NAME_FOR_CLI } from "#constants";

const DEFAULT_INSTRUCTIONS_ENTRY = "index.ts";

export default async function getInstructionsEntry({ powerupRoot }: { powerupRoot: FileRef }): Promise<string> {
  const packageJsonRef = powerupRoot.append("/package.json");

  if (!(await packageJsonRef.exists())) {
    return DEFAULT_INSTRUCTIONS_ENTRY;
  }

  try {
    const pkgJson = await packageJsonRef.json() as Record<string, unknown>;
    const validated = powerupPropertySchema.safeParse(pkgJson[SINGULAR_NAME_FOR_CLI]);

    return validated.success ? validated.data.instructions : DEFAULT_INSTRUCTIONS_ENTRY;
  } catch {
    return DEFAULT_INSTRUCTIONS_ENTRY;
  }
}