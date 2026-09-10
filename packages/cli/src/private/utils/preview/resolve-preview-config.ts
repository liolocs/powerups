import type { FileRef } from "@rcompat/fs";
import type { Instructions } from "@liolocs/powerups-sdk";
import type { ResolvedVariable } from "#utils/use/resolved-variable";
import readPreviewJson from "#utils/preview/read-preview-json";
import normalizeFlagName from "#utils/shared/normalize-flag-name";
import preview_errors from "#errors/previewErrors";

const PREVIEW_EXCLUDE_FLAGS = ["--dry-run", "-dr", "--run", "--output", "-o", "--watch"];

export type PreviewConfig = {
  variables: ResolvedVariable;
  run?: string;
  output: string;
  watch: boolean;
};

export default async function resolvePreviewConfig({
  powerupRoot,
  instructions,
  rawFlags,
}: {
  powerupRoot: FileRef;
  instructions: Instructions;
  rawFlags: { flag: string; value?: string }[];
}): Promise<PreviewConfig> {
  const previewJson = await readPreviewJson({ powerupRoot });

  const variables: ResolvedVariable = { ...(previewJson?.variables ?? {}) };

  for (const rawFlag of rawFlags) {
    if (PREVIEW_EXCLUDE_FLAGS.includes(rawFlag.flag)) {
      continue;
    }

    variables[normalizeFlagName(rawFlag.flag)] = rawFlag.value ?? "";
  }

  const missing = instructions.variables.required.filter(name => {
    const provided = Object.keys(variables).find(key => key.toLowerCase() === name.toLowerCase());
    return provided === undefined || variables[provided] === "";
  });

  if (missing.length > 0) {
    throw preview_errors.missing_variables(missing, instructions.variables.required);
  }

  const flagRun = getFlagValue({ rawFlags, long: "--run" });
  const flagOutput = getFlagValue({ rawFlags, long: "--output", short: "-o" });
  const watchFlag = rawFlags.find(f => f.flag === "--watch");

  const run = flagRun ?? previewJson?.run;
  const output = flagOutput ?? previewJson?.output ?? "preview";
  const watch = watchFlag !== undefined
    ? watchFlag.value !== "false"
    : (previewJson?.watch ?? run !== undefined);

  return { variables, run, output, watch };
}

function getFlagValue({
  rawFlags,
  long,
  short,
}: {
  rawFlags: { flag: string; value?: string }[];
  long: string;
  short?: string;
}): string | undefined {
  for (const rawFlag of rawFlags) {
    if (rawFlag.flag === long || (short !== undefined && rawFlag.flag === short)) {
      return rawFlag.value ?? "";
    }

    if (rawFlag.value !== undefined && rawFlag.flag.startsWith(long + "=")) {
      return rawFlag.value;
    }
  }

  return undefined;
}
