import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import generateOutputErrors from "#errors/outputGenerateErrors";
import outputRunErrors from "#errors/outputRunErrors";
import { instructionsSchema } from "#schemas/instruction";
import { extractVariables } from "#utils/variables";
import { resolveOutputPath } from "#utils/output-path";
import { checkOutput } from "#utils/check-output";
import { resolveOutput } from "#utils/resolve";
import { logRun } from "#utils/metrics";
import { runTemplate } from "#runners/output/index";
import { MAIN_FOLDER, OUTPUTS_FOLDER } from "#constants";

const EXCLUDE_FLAGS = ["--dry-run", "-d", "--help", "-h"];

const run = new Command({
  name: "run",
  description: "Run a output, rendering templates with variables",
  flags: [
    {
      name: "dry-run",
      long: "dry-run",
      short: "d",
      description: "Print output to stdout instead of writing files",
    },
  ],
  subcommands: [],
  action: async ({ flags, subcommands, rawFlags, context }) => {
    // 1. Extract output name from positional args
    const outputName = subcommands?.[0];
    if (!is.defined(outputName)) {
      throw outputRunErrors.missing_output_name();
    }

    // 2. Locate .saved folder
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasDryFolder = await fs.exists(mainFolder);

    if (!hasDryFolder) {
      throw generateOutputErrors.dry_folder_not_found();
    }

    // 3. Resolve output folders
    const outputsFolder = mainFolder.append(`/${OUTPUTS_FOLDER}`);
    const outputFolder = outputsFolder.append(`/${outputName}`);

    if (!(await fs.exists(outputFolder))) {
      throw outputRunErrors.output_not_found(outputName);
    }

    // 4. Validate output (schema, templates, suboutput tree)
    const issues = await checkOutput({
      rootOutputDir: outputsFolder,
      currentOutputDir: outputFolder,
    });

    if (issues.length > 0) {
      throw outputRunErrors.invalid_composition(issues);
    }

    // 5. Load & parse instructions (safe — validated)
    const outputPath = outputFolder.append("/instructions.json");
    const instructions = instructionsSchema.parse(await outputPath.json());

    // 6. Extract & validate variables
    const variables = extractVariables(
      rawFlags ?? [],
      instructions.variables,
      EXCLUDE_FLAGS,
    );

    // 7. Detect --dry-run via rawFlags
    const isDryRun = (rawFlags ?? []).some(
      f => f.flag === "--dry-run" || f.flag === "-d",
    );

    // 8. Resolve output tree → flat list of render tasks
    const tasks = await resolveOutput({
      outputName,
      variables,
      outputsFolder,
    });

    // 9. Process each render task
    let totalCharacters = 0;

    for (const task of tasks) {
      if (!(await fs.exists(task.templatePath))) {
        throw outputRunErrors.template_not_found(task.templatePath.name);
      }

      const rendered = await runTemplate({
        templatePath: task.templatePath,
        variables: task.variables,
      });
      totalCharacters += rendered.length;
      const resolvedPath = resolveOutputPath(task.outputPath, task.variables);

      if (isDryRun) {
        cli.print(`=== ${resolvedPath} ===`);
        cli.print(rendered);
        cli.print("");
      } else {
        const targetPath = root.append(`/${resolvedPath}`);
        await fs.create(targetPath.directory);
        await targetPath.write(rendered);
        cli.print(`Wrote ${resolvedPath}`);
      }
    }

    // 10. Log metrics for non-dry-run successful runs (best-effort)
    if (!isDryRun) {
      try {
        await logRun({ output: outputName, characters: totalCharacters }, root);
      } catch {
        // Metrics are secondary — never crash a successful run
      }
    }
  },
});

export default run;