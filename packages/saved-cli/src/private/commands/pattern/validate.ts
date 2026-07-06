import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generate_pattern_errors from "#errors/patternGenerateErrors";
import pattern_validate_errors from "#errors/patternValidateErrors";
import { checkPattern } from "#utils/check-pattern";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

interface ValidationFailure {
  name: string;
  issues: string[];
}

const validate = new Command({
  name: "validate",
  description: "Validate pattern instructions.json files and templates",
  flags: [
    {
      name: "name",
      long: "name",
      short: "n",
      description: "Validate only this pattern",
    },
  ],
  subcommands: [],
  action: async ({ flags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasDryFolder = await fs.exists(mainFolder);

    if (!hasDryFolder) {
      throw generate_pattern_errors.dry_folder_not_found();
    }

    const patternsFolder = mainFolder.append(`/${PATTERNS_FOLDER}`);
    const hasPatternsFolder = await fs.exists(patternsFolder);

    if (!hasPatternsFolder) {
      throw pattern_validate_errors.no_patterns_found();
    }

    // Single-pattern path: validate one folder, throw on missing/invalid.
    if (is.defined(flags.name) === true) {
      const patternFolder = patternsFolder.append(`/${flags.name}`);

      if (!(await fs.exists(patternFolder))) {
        throw pattern_validate_errors.pattern_not_found(flags.name);
      }

      const issues = await checkPattern({
        rootPatternDir: patternsFolder,
        currentPatternDir: patternFolder,
      });

      if (issues.length > 0) {
        throw pattern_validate_errors.invalid_pattern(
          flags.name,
          issues.join("; "),
        );
      }

      cli.print(`Pattern ${flags.name} is valid.`);
      return;
    }

    // All-patterns path: discover every instructions.json, report per-file.
    const patternFiles = await patternsFolder.files({
      recursive: true,
      filter: (file) => file.name === "instructions.json",
    });

    if (patternFiles.length === 0) {
      throw pattern_validate_errors.no_patterns_found();
    }

    const failures: ValidationFailure[] = [];

    for (const patternFile of patternFiles) {
      const name = patternFile.directory.name;
      const issues = await checkPattern({
        rootPatternDir: patternsFolder,
        currentPatternDir: patternFile.directory,
      });

      if (issues.length > 0) {
        failures.push({ name, issues });
      }
    }

    if (failures.length > 0) {
      cli.print(`Validation failed for ${failures.length} pattern(s):`);
      cli.print("");

      for (const { name, issues } of failures) {
        cli.print(`  ${name}:`);

        for (const issue of issues) {
          cli.print(`    - ${issue}`);
        }
      }

      cli.print("");
      throw pattern_validate_errors.validation_failed(failures.length);
    }

    cli.print(`Validated ${patternFiles.length} pattern(s). All valid.`);
  },
});

export default validate;