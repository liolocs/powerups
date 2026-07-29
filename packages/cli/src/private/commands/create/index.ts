import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import create_errors from "#errors/createErrors";
import { packageDependencyGroupArraySchema, type Instructions } from "#schemas/instruction";
import { packageJsonSchema } from "#schemas/package";
import { addPackageToConfig } from "#utils/config";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  powerupsFolderMap,
  PACKAGE_FILE,
  type PowerUpType,
  CLI_NAME,
  SINGULAR_NAME,
  CAPITALIZED_SINGLULAR_CLI_NAME,
} from "#constants";

const create = new Command({
  name: "create",
  description: `Create a new ${SINGULAR_NAME}`,
  flags: [
    {
      name: "pack",
      long: "pack",
      short: "pk",
      description: `Package name to create the ${SINGULAR_NAME} in`,
    },
    {
      name: "type",
      long: "type",
      short: "t",
      description: `${CAPITALIZED_SINGLULAR_CLI_NAME} type (multi-use or single-use)`,
      required: true,
    },
    {
      name: "name",
      long: "name",
      short: "n",
      description: `${CAPITALIZED_SINGLULAR_CLI_NAME} name`,
      required: true,
    },
    {
      name: "intent",
      long: "intent",
      short: "i",
      description: "Comma-separated intent strings",
    },
    {
      name: "description",
      long: "description",
      short: "d",
      description: "Human-readable description of what this does",
      required: true,
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

  action: async ({ flags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);

    const hasMainFolder = await fs.exists(mainFolder);
    if (!hasMainFolder) {
      throw create_errors.main_folder_not_found();
    }

    // Validate --pack
    const packageName = flags.pack;
    if (!is.defined(packageName) || packageName.length === 0) {
      throw create_errors.missing_pack();
    }

    const packageDir = mainFolder.append(`/${INTERNAL_FOLDER}/${packageName}`);
    if (!(await fs.exists(packageDir))) {
      throw create_errors.pack_not_found(packageName);
    }

    // Validate --type
    const type = flags.type as string | undefined;
    if (type !== "multi-use" && type !== "single-use") {
      throw create_errors.missing_type();
    }
    const powerupsType = type as PowerUpType;

    const name = flags.name!;
    const typeFolderName = powerupsFolderMap[powerupsType];
    const typeFolder = packageDir.append(
      `/${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolderName}`,
    );

    // Ensure type folder exists
    if (!(await fs.exists(typeFolder))) {
      await fs.create(typeFolder);
    }

    const outputFolder = typeFolder.append(`/${name}`);
    const outputPath = outputFolder.append("/instructions.json");

    const hasOutput = await fs.exists(outputFolder);
    if (hasOutput) {
      throw create_errors.already_exists(name);
    }

    await fs.create(outputFolder);

    const intent = is.defined(flags.intent) === true
      ? flags.intent.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const required = is.defined(flags.variables) === true
      ? flags.variables.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const optional = is.defined(flags.optionalVariables) === true
      ? flags.optionalVariables.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    let packageDependencies: Instructions["packageDependencies"] = undefined;

    if (is.defined(flags.packageDeps) === true) {
      try {
        packageDependencies = packageDependencyGroupArraySchema.parse(
          JSON.parse(flags.packageDeps),
        ) as Instructions["packageDependencies"];
      } catch {
        throw create_errors.invalid_package_deps_json();
      }
    }

    const instructions = {
      name,
      description: flags.description!,
      variables: {
        required,
        ...(optional.length > 0 ? { optional } : {}),
      },
      intent,
      packageDependencies,
      steps: [] as never,
    };

    await outputPath.writeJSON(instructions as never);

    const packageJsonPath = packageDir.append(`/${PACKAGE_FILE}`);
    const pkgJson = packageJsonSchema.parse(await packageJsonPath.json());
    const pkgJsonPowerups = pkgJson[CLI_NAME];

    let powerupsMap: Record<string, string> = {};

    if (is.truthy(
      pkgJsonPowerups.active[
      typeFolderName as keyof typeof pkgJsonPowerups.active
      ],
    )) {
      powerupsMap = pkgJsonPowerups.active[
      typeFolderName as keyof typeof pkgJsonPowerups.active
      ] as Record<string, string>;
    }

    powerupsMap[name] =
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolderName}/${name}/instructions.json`;

    (pkgJson[CLI_NAME].active as Record<string, Record<string, string>>)[typeFolderName] = powerupsMap;

    await packageJsonPath.writeJSON(pkgJson as never);

    // Add package to project config (if not already listed)
    await addPackageToConfig(root, packageName);

    cli.print(`Created ${SINGULAR_NAME}: ${name} (${powerupsType}) in package: ${packageName}\n`);
  },
});

export default create;