import { GLOBAL_ROOT, SINGULAR_NAME_FOR_CLI, CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";

import checkForPreCreateErrors from "#utils/create/check-for-pre-create-errors/index";
import buildVariables from "#utils/create/build-variables";
import captureFiles from "#utils/create/capture-files/index";
import registerPowerup from "#utils/shared/register-powerup";
import printCreateSummary from "#utils/create/print-create-summary";

import getPowerup from "#utils/use/get-powerup/getPowerup";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import runPowerup from "#utils/use/run-powerup/index";

const dryRunFlag = {
  name: "dryRun", long: "dry-run", short: "dr",
  description: "Print output to stdout instead of writing files",
  type: "boolean",
} as const satisfies Flag;

const captureFlag = {
  name: "capture", long: "capture", short: "c",
  description: `Capture files into the new ${SINGULAR_NAME_FOR_CLI}: "all" or "workingDir"`,
} as const satisfies Flag;

const localFlag = {
  name: "local", long: "local", short: "l",
  description: "Create locally (default: global)",
  type: "boolean",
} as const satisfies Flag;

const descriptionFlag = {
  name: "description", long: "description", short: "d",
  description: "Human-readable description (required)",
} as const satisfies Flag;

const intentFlag = {
  name: "intent", long: "intent", short: "i",
  description: "Comma-separated intent keywords",
} as const satisfies Flag;

const variablesFlag = {
  name: "variables", long: "variables", short: "v",
  description: "Comma-separated required variable names",
} as const satisfies Flag;

const optionalVariablesFlag = {
  name: "optionalVariables", long: "optional-variables", short: "ov",
  description: "Comma-separated optional variable names",
} as const satisfies Flag;

const typeFlag = {
  name: "type", long: "type", short: "t",
  description: `Powerup type: multi-use or single-use (defaults to single-use)`,
} as const satisfies Flag;

const create = new Command({
  name: "create",
  description: `Create a ${SINGULAR_NAME_FOR_CLI}`,
  flags: [dryRunFlag, captureFlag, localFlag, descriptionFlag, intentFlag, variablesFlag, optionalVariablesFlag, typeFlag],
  subcommands: [],

  action: async ({ context, subcommands, flags }) => {
    const projectRoot: FileRef = context?.root ?? await runtime.projectRoot();
    const isDryRun = flags.dryRun === true;
    const isLocal = flags.local === true;
    const powerupName = subcommands?.[0];

    const cwd = isLocal ? projectRoot : fs.ref(GLOBAL_ROOT);
    const outputPath = isLocal
      ? `${CLI_FOLDER_NAME}/${INSTALLED_FOLDER.internal}`
      : INSTALLED_FOLDER.internal;

    await checkForPreCreateErrors({
      powerupName,
      captureValue: flags.capture,
      description: flags.description,
      isLocal,
      powerupDirectory: cwd.append(`/${outputPath}`),
      projectRoot,
      globalRoot: fs.ref(GLOBAL_ROOT),
    });

    const powerup = await getPowerup({
      cwd: projectRoot,
      name: "create-powerup",
      globalPowerupsDir: fs.ref(GLOBAL_ROOT),
    });

    const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(
      powerup.instructions,
    );

    const variables = buildVariables({
      name: powerupName!,
      description: flags.description,
      intent: flags.intent,
      requiredVariables: flags.variables,
      optionalVariables: flags.optionalVariables,
      powerupType: flags.type,
      outputPath,
    });

    await runPowerup({
      destination: cwd,
      powerupDirectory: powerup.location,
      instructions: validatedCompiledInstructions,
      isDryRun,
      variables,
      powerupVersion: powerup.version,
      powerupLocation: powerup.location.path,
    });

    let captureResult;

    if (flags.capture !== undefined) {
      const newPowerupDirectory = cwd.append(`/${outputPath}/${powerupName}`);
      const indexFilePath = newPowerupDirectory.append("/index.ts");

      captureResult = await captureFiles({
        captureMode: flags.capture as "all" | "workingDir",
        projectRoot,
        workingDir: projectRoot,
        newPowerupDirectory,
        indexFilePath,
        isDryRun,
      });
    }

    if (!isDryRun) {
      await registerPowerup({ configEntry: `internal:${powerupName!}`, isLocal, projectRoot });
    }

    printCreateSummary({
      name: powerupName!,
      isDryRun,
      captureResult,
      outputPath: cwd.append(`/${outputPath}/${powerupName}`).path,
    });
  },
});

export default create;