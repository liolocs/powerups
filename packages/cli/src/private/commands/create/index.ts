import { GLOBAL_ROOT, SINGULAR_NAME_FOR_CLI, CLI_FOLDER_NAME, INSTALLED_FOLDER } from "#constants";
import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import is from "@rcompat/is";
import fs from "@rcompat/fs";

import checkForPreCreateErrors from "#utils/create/check-for-pre-create-errors/index";
import buildVariables from "#utils/create/build-variables";
import captureFiles from "#utils/create/capture-files/index";
import registerPowerup from "#utils/shared/register-powerup";
import printCreateSummary from "#utils/create/print-create-summary";

import getPowerup from "#utils/use/get-powerup/getPowerup";
import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import runPowerup from "#utils/use/run-powerup/index";

const dryRunFlag: Flag = {
  name: "dryRun", long: "dry-run", short: "dr",
  description: "Print output to stdout instead of writing files",
};

const captureFlag: Flag = {
  name: "capture", long: "capture", short: "c",
  description: `Capture files into the new ${SINGULAR_NAME_FOR_CLI}: "all" or "workingDir"`,
};

const localFlag: Flag = {
  name: "local", long: "local", short: "l",
  description: "Create locally (default: global)",
};

const descriptionFlag: Flag = {
  name: "description", long: "description", short: "d",
  description: "Human-readable description (required)",
};

const intentFlag: Flag = {
  name: "intent", long: "intent", short: "i",
  description: "Comma-separated intent keywords",
};

const variablesFlag: Flag = {
  name: "variables", long: "variables", short: "v",
  description: "Comma-separated required variable names",
};

const optionalVariablesFlag: Flag = {
  name: "optionalVariables", long: "optional-variables", short: "ov",
  description: "Comma-separated optional variable names",
};

const typeFlag: Flag = {
  name: "type", long: "type", short: "t",
  description: `Powerup type: multi-use or single-use (defaults to single-use)`,
};

const create = new Command({
  name: "create",
  description: `Create a ${SINGULAR_NAME_FOR_CLI}`,
  flags: [dryRunFlag, captureFlag, localFlag, descriptionFlag, intentFlag, variablesFlag, optionalVariablesFlag, typeFlag],
  subcommands: [],

  action: async ({ context, subcommands, flags }) => {
    const projectRoot: FileRef = context?.root ?? await runtime.projectRoot();
    const isDryRun = is.defined(flags.dryRun);
    const isLocal = is.defined(flags.local);
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

    if (is.defined(flags.capture)) {
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