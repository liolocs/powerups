import {
  PACKAGE_JSON_KEYWORD_PROPERTY,
  PACKAGE_JSON,
  SINGULAR_NAME_FOR_CLI,
  type PowerUpType,
} from "#constants";
import {
  instructionsSchema,
  type Instructions,
  type Step,
} from "#schemas/instruction";
import { addPackageToConfig } from "#utils/config";
import { getPackageDependencies } from "#utils/create/get-package-deps";
import cli from "@rcompat/cli";
import fs, { type FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { createStepsFromWorkingDir } from "#utils/create/steps/index";

type CreatePowerupOverrides = {
  pack?: string;
  type: PowerUpType;
  description?: string;
  intent?: string;
  variables?: string;
  optionalVariables?: string;
  packageDeps?: string;
};

type CreatePowerupResult = {
  newFileCount: number;
  modifiedFileCount: number;
  deletedFileCount: number;
  warnings: string[];
};

function parseCommaList(value: string | undefined): string[] {
  if (!is.defined(value) || value.length === 0) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

export async function createPowerup({
  name,
  workingDir,
  projectRoot,
  type: powerupsType,
  outputDir,
  ...overrides
}: {
  name: string;
  workingDir?: FileRef;
  projectRoot: FileRef;
  outputDir: FileRef;
} & CreatePowerupOverrides): Promise<CreatePowerupResult> {
  const root: FileRef = projectRoot;

  const description = overrides.description ?? "";
  const intent = parseCommaList(overrides.intent);
  const required = parseCommaList(overrides.variables);
  const optional = parseCommaList(overrides.optionalVariables);

  const packageDependencies = getPackageDependencies(overrides.packageDeps);

  // Create the powerup directory at internal/<name>/ with its package.json
  await createPowerupPackage({
    name,
    outputDir,
  });

  const warnings: string[] = [];
  let newFileCount = 0;
  let modifiedFileCount = 0;
  let deletedFileCount = 0;
  let steps: Step[] = [];

  if (is.defined(workingDir)) {
    const result = await createStepsFromWorkingDir({
      workingDir,
      projectRoot,
      outputFolder: outputDir,
      packageDependencies,
    });

    newFileCount = result.newFileCount;
    modifiedFileCount = result.modifiedFileCount;
    deletedFileCount = result.deletedFileCount;
    warnings.push(...result.warnings);
    steps = result.steps;
  }

  const instructions = buildInstructions({
    name,
    type: powerupsType,
    description,
    required,
    optional,
    intent,
    packageDependencies,
    steps,
  });

  instructionsSchema.parse(instructions);

  const outputPath = outputDir.append("/instructions.json");
  await outputPath.writeJSON(instructions as never);

  // Register the powerup name in the project config so `use` can find it
  await addPackageToConfig(root, name);

  return {
    newFileCount,
    modifiedFileCount,
    deletedFileCount,
    warnings,
  };
}

/**
 * Create the powerup directory at internal/<name>/ with a package.json
 * that registers the powerup. Returns the powerup directory.
 */
async function createPowerupPackage({
  name,
  outputDir,
}: {
  name: string;
  outputDir: FileRef;
}): Promise<void> {
  await fs.create(outputDir);

  const packageJson = {
    name,
    version: "1.0.0",
    description: "",
    keywords: [PACKAGE_JSON_KEYWORD_PROPERTY],
    [SINGULAR_NAME_FOR_CLI]: "./instructions.json",
  };

  await outputDir.append(`/${PACKAGE_JSON}`).writeJSON(packageJson as never);
}

function buildInstructions({
  name,
  type,
  description,
  required,
  optional,
  intent,
  packageDependencies,
  steps,
}: {
  name: string;
  type: PowerUpType;
  description: string;
  required: string[];
  optional: string[];
  intent: string[];
  packageDependencies: Instructions["packageDependencies"];
  steps: Step[];
}): Instructions {
  return {
    name,
    type,
    description,
    variables: {
      required,
      optional: optional.length > 0 ? optional : undefined,
    },
    intent,
    packageDependencies,
    steps,
  };
}

export function printCreateSummary({
  name,
  type,
  result,
}: {
  name: string;
  type: string;
  result: CreatePowerupResult;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  cli.print(`${green("✓")} Created powerup: ${name} (${type})\n`);

  if (result.newFileCount > 0 || result.modifiedFileCount > 0 || result.deletedFileCount > 0) {
    cli.print(`  ${dim("files:")} ${result.newFileCount} new, ${result.modifiedFileCount} modified, ${result.deletedFileCount} deleted\n`);
  }

  if (result.warnings.length > 0) {
    cli.print(`  ${dim("warnings:")}\n`);
    for (const warning of result.warnings) {
      cli.print(`    - ${warning}\n`);
    }
  }
}