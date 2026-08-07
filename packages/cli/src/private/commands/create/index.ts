import { type FileRef } from "@rcompat/fs";
import path from "node:path";
import is from "@rcompat/is";
import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import create_errors from "#errors/createErrors";
import {
  SINGULAR_NAME_FOR_CLI,
  CAPITALIZED_SINGLULAR_CLI_NAME,
  CLI_FOLDER_NAME,
  INTERNAL_FOLDER,
} from "#constants";
import { createPowerup, printCreateSummary } from "#utils/create/create-powerup";

const create = new Command({
  name: "create",
  description: `Create a new ${SINGULAR_NAME_FOR_CLI}`,
  flags: [
    {
      name: "workingDir",
      long: "working-dir",
      short: "wd",
      description: "Generate from git changes in this directory (or cwd if no path given)",
    },
    {
      name: "pack",
      long: "pack",
      short: "pk",
      description: `Package name (defaults to package.json name)`,
    },
    {
      name: "type",
      long: "type",
      short: "t",
      description: `${CAPITALIZED_SINGLULAR_CLI_NAME} type: multi-use or single-use (defaults to single-use)`,
    },
    {
      name: "description",
      long: "description",
      short: "d",
      description: "Human-readable description",
    },
    {
      name: "intent",
      long: "intent",
      short: "i",
      description: "Comma-separated intent keywords",
    },
    {
      name: "variables",
      long: "variables",
      short: "v",
      description: "Comma-separated required variable names",
    },
    {
      name: "optionalVariables",
      long: "optional-variables",
      short: "ov",
      description: "Comma-separated optional variable names",
    },
    {
      name: "packageDeps",
      long: "package-deps",
      short: "p",
      description: "JSON package dependencies specification",
    },
  ],

  subcommands: [],

  action: async ({ subcommands, flags, rawFlags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();

    const name = subcommands?.[0];

    if (!is.defined(name) || name.length === 0) {
      throw create_errors.missing_name();
    }

    const mainFolder = root.append(`/${CLI_FOLDER_NAME}`);

    if (!(await fs.exists(mainFolder))) {
      throw create_errors.main_folder_not_found();
    }

    const internalFolder = mainFolder.append(`/${INTERNAL_FOLDER}`);

    if (!(await fs.exists(internalFolder))) {
      await fs.create(internalFolder);
    }

    const workingDirRaw = rawFlags?.find(
      f => f.flag === "--working-dir" || f.flag === "--wd",
    );
    const hasWorkingDir = is.defined(workingDirRaw);

    const powerupsType = is.defined(flags.type) ? flags.type : "single-use";
    if (powerupsType !== "multi-use" && powerupsType !== "single-use") {
      throw create_errors.missing_type();
    }

    const outputDir = mainFolder.append(`/${INTERNAL_FOLDER}/${name}`);

    if (await fs.exists(outputDir)) {
      throw create_errors.already_exists(name);
    }

    const workingDirFileRef = is.defined(workingDirRaw!.value)
      && workingDirRaw!.value.length > 0
      ? fs.ref(path.resolve(workingDirRaw!.value))
      : runtime.cwd();

    const result = await createPowerup({
      name,
      workingDir: hasWorkingDir ? workingDirFileRef : undefined,
      projectRoot: root,
      outputDir,
      pack: flags.pack,
      type: powerupsType,
      description: flags.description,
      intent: flags.intent,
      variables: flags.variables,
      optionalVariables: flags.optionalVariables,
      packageDeps: flags.packageDeps,
    });


    printCreateSummary({ name, type: powerupsType, result });
  },
});

export default create;