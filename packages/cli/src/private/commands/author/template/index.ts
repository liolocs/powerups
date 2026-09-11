import { Command, type Flag } from "@liolocs/program";
import type { FileRef } from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import fs from "@rcompat/fs";
import cli from "@rcompat/cli";

import checkCompiledInstructionsForErrors from "#utils/validate/check-compiled-instructions-for-errors/index";
import loadInstructionsFromSource from "#utils/preview/load-instructions-from-source";
import readPreviewJson from "#utils/preview/read-preview-json";
import getInstructionsEntry from "#utils/preview/get-instructions-entry";
import normalizeFlagName from "#utils/shared/normalize-flag-name";
import {
  convertStepToDynamic,
  revertStepToStatic,
  type TemplateEngine,
} from "#utils/template-conversion/convert-step";
import { replaceStepInIndex } from "#utils/template-conversion/steps-region";
import template_errors from "#errors/templateErrors";

const revertFlag = {
  name: "revert", long: "revert", short: "r",
  description: "Convert a dynamic (template) step back to static",
  type: "boolean",
} as const satisfies Flag;

const engineFlag = {
  name: "engine", long: "engine", short: "e",
  description: "Template engine for conversion: ts (default) or njk",
} as const satisfies Flag;

const TEMPLATE_EXCLUDE_FLAGS = ["--revert", "-r", "--engine", "-e", "--dry-run", "-dr"];

const template = new Command({
  name: "template",
  description: `Convert a powerup step between static and dynamic (template) form`,
  flags: [revertFlag, engineFlag],
  subcommands: [],

  action: async ({ context, subcommands, flags, rawFlags }) => {
    const powerupRoot: FileRef = context?.root ?? runtime.cwd();
    const outputPath = subcommands?.[0];

    const instructions = await loadInstructionsFromSource({ powerupRoot });
    const { validatedCompiledInstructions } = await checkCompiledInstructionsForErrors(instructions);

    if (outputPath === undefined) {
      printStepListing({ steps: validatedCompiledInstructions.steps });
      return;
    }

    const matchingSteps = validatedCompiledInstructions.steps.filter(
      step => step.type !== "read" && step.type !== "install"
        && (step as { outputPath?: string }).outputPath === outputPath,
    );

    if (matchingSteps.length === 0) {
      throw template_errors.step_not_found(outputPath);
    }

    const step = matchingSteps[0]!;

    if (flags.revert === true) {
      if (step.type !== "dynamic-create" && step.type !== "dynamic-modify") {
        throw template_errors.not_dynamic(outputPath);
      }

      const variables = await resolveVariablesForRevert({
        powerupRoot,
        rawFlags: rawFlags ?? [],
        instructions: validatedCompiledInstructions,
      });

      const declaredVariableNames = [
        ...validatedCompiledInstructions.variables.required,
        ...(validatedCompiledInstructions.variables.optional ?? []),
      ];

      const result = await revertStepToStatic({ step, powerupRoot, variables, declaredVariableNames });

      await writeStaticAndRemoveTemplate({ powerupRoot, result });
      await rewriteIndexStep({ powerupRoot, stepName: step.name, newStep: result.newStep });

      const green = cli.fg.green;
      cli.print(`${green("✓")} Reverted ${outputPath} to static (${result.staticPath})\n`);
      return;
    }

    if (step.type !== "create" && step.type !== "modify") {
      throw template_errors.already_dynamic(outputPath);
    }

    const engine = resolveEngine({ value: flags.engine });
    const sourceRef = powerupRoot.append(`/${step.file}`);
    const sourceContent = await sourceRef.text();

    const result = convertStepToDynamic({ step, sourceContent, engine });

    const templateFileRef = powerupRoot.append(`/${result.templatePath}`);
    await fs.create(templateFileRef.directory);
    await templateFileRef.write(result.templateContent);
    await sourceRef.remove();

    await rewriteIndexStep({ powerupRoot, stepName: step.name, newStep: result.newStep });

    const green = cli.fg.green;
    const dim = cli.fg.dim;
    cli.print(`${green("✓")} Converted ${outputPath} to dynamic\n`);
    cli.print(`  ${dim("template:")} ${result.templatePath}\n`);
    cli.print(`  ${dim("next:")} edit the template to inject \${variables}\n`);
  },
});

function resolveEngine({ value }: { value?: string }): TemplateEngine {
  if (value === undefined || value === "ts") {
    return "ts";
  }

  if (value === "njk") {
    return "njk";
  }

  throw template_errors.invalid_engine(value);
}

async function resolveVariablesForRevert({
  powerupRoot,
  rawFlags,
  instructions,
}: {
  powerupRoot: FileRef;
  rawFlags: { flag: string; value?: string }[];
  instructions: { variables: { required: string[]; optional?: string[] } };
}): Promise<Record<string, string>> {
  const previewJson = await readPreviewJson({ powerupRoot });
  const variables: Record<string, string> = { ...(previewJson?.variables ?? {}) };

  for (const rawFlag of rawFlags) {
    if (TEMPLATE_EXCLUDE_FLAGS.includes(rawFlag.flag)) {
      continue;
    }

    variables[normalizeFlagName(rawFlag.flag)] = rawFlag.value ?? "";
  }

  return variables;
}

async function writeStaticAndRemoveTemplate({
  powerupRoot,
  result,
}: {
  powerupRoot: FileRef;
  result: { staticPath: string; staticContent: string; templatePath: string };
}): Promise<void> {
  const staticFileRef = powerupRoot.append(`/${result.staticPath}`);
  await fs.create(staticFileRef.directory);
  await staticFileRef.write(result.staticContent);

  const templateFileRef = powerupRoot.append(`/${result.templatePath}`);
  if (await templateFileRef.exists()) {
    await templateFileRef.remove();
  }
}

async function rewriteIndexStep({
  powerupRoot,
  stepName,
  newStep,
}: {
  powerupRoot: FileRef;
  stepName: string;
  newStep: import("@liolocs/powerups-sdk").Step;
}): Promise<void> {
  const entryFile = await getInstructionsEntry({ powerupRoot });
  const entryFileRef = powerupRoot.append(`/${entryFile}`);
  const entryContent = await entryFileRef.text();
  await entryFileRef.write(replaceStepInIndex({ indexContent: entryContent, stepName, newStep }));
}

function printStepListing({ steps }: { steps: import("@liolocs/powerups-sdk").Step[] }): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  if (steps.length === 0) {
    cli.print(`${dim("No steps defined.")}\n`);
    return;
  }

  for (const step of steps) {
    const outputPath = step.type === "read" ? step.path
      : step.type === "install" ? "(install)"
      : (step as { outputPath: string }).outputPath;
    const kind = step.type === "create" || step.type === "modify"
      ? "static"
      : step.type === "dynamic-create" || step.type === "dynamic-modify"
        ? "dynamic"
        : step.type;

    cli.print(`${green(step.name)}  ${dim(kind)}  ${outputPath}\n`);
  }
}

export default template;
