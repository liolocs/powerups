import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generatePatternErrors from "#errors/patternGenerateErrors";
import patternRunErrors from "#errors/patternRunErrors";
import { instructionsSchema } from "#schemas/instruction";
import { extractVariables } from "#utils/variables";
import { resolveOutputPath } from "#utils/output-path";
import { checkPattern } from "#utils/check-pattern";
import { resolvePattern } from "#utils/resolve";
import { logRun } from "#utils/metrics";
import { runTemplate } from "#runners/pattern/index";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

const EXCLUDE_FLAGS = ["--dry-run", "-d", "--help", "-h"];

const run = new Command({
  name: "run",
  description: "Run a pattern, rendering templates with variables",
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
    // 1. Extract pattern name from positional args
    const patternName = subcommands?.[0];
    if (!is.defined(patternName)) {
      throw patternRunErrors.missing_pattern_name();
    }

    // 2. Locate .saved folder
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasDryFolder = await fs.exists(mainFolder);

    if (!hasDryFolder) {
      throw generatePatternErrors.dry_folder_not_found();
    }

    // 3. Resolve pattern folders
    const patternsFolder = mainFolder.append(`/${PATTERNS_FOLDER}`);
    const patternFolder = patternsFolder.append(`/${patternName}`);

    if (!(await fs.exists(patternFolder))) {
      throw patternRunErrors.pattern_not_found(patternName);
    }

    // 4. Validate pattern (schema, templates, subpattern tree)
    const issues = await checkPattern({
      rootPatternDir: patternsFolder,
      currentPatternDir: patternFolder,
    });

    if (issues.length > 0) {
      throw patternRunErrors.invalid_composition(issues);
    }

    // 5. Load & parse instructions (safe — validated)
    const patternPath = patternFolder.append("/instructions.json");
    const instructions = instructionsSchema.parse(await patternPath.json());

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

    // 8. Resolve pattern tree → flat list of render tasks
    const tasks = await resolvePattern({
      patternName,
      variables,
      patternsFolder,
    });

    // 9. Process each render task
    let totalCharacters = 0;

    for (const task of tasks) {
      if (!(await fs.exists(task.templatePath))) {
        throw patternRunErrors.template_not_found(task.templatePath.name);
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
        await logRun({ pattern: patternName, characters: totalCharacters }, root);
      } catch {
        // Metrics are secondary — never crash a successful run
      }
    }
  },
});

export default run;