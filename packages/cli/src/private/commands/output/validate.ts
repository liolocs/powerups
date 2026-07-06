import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import generate_output_errors from "#errors/outputGenerateErrors";
import output_validate_errors from "#errors/outputValidateErrors";
import { checkOutput } from "#utils/check-output";
import { MAIN_FOLDER, OUTPUTS_FOLDER } from "#constants";

interface ValidationFailure {
  name: string;
  issues: string[];
}

const validate = new Command({
  name: "validate",
  description: "Validate output instructions.json files and templates",
  flags: [
    {
      name: "name",
      long: "name",
      short: "n",
      description: "Validate only this output",
    },
  ],
  subcommands: [],
  action: async ({ flags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);
    const hasDryFolder = await fs.exists(mainFolder);

    if (!hasDryFolder) {
      throw generate_output_errors.dry_folder_not_found();
    }

    const outputsFolder = mainFolder.append(`/${OUTPUTS_FOLDER}`);
    const hasOutputsFolder = await fs.exists(outputsFolder);

    if (!hasOutputsFolder) {
      throw output_validate_errors.no_outputs_found();
    }

    // Single-output path: validate one folder, throw on missing/invalid.
    if (is.defined(flags.name) === true) {
      const outputFolder = outputsFolder.append(`/${flags.name}`);

      if (!(await fs.exists(outputFolder))) {
        throw output_validate_errors.output_not_found(flags.name);
      }

      const issues = await checkOutput({
        rootOutputDir: outputsFolder,
        currentOutputDir: outputFolder,
      });

      if (issues.length > 0) {
        throw output_validate_errors.invalid_output(
          flags.name,
          issues.join("; "),
        );
      }

      cli.print(`Output ${flags.name} is valid.`);
      return;
    }

    // All-outputs path: discover every instructions.json, report per-file.
    const outputFiles = await outputsFolder.files({
      recursive: true,
      filter: (file) => file.name === "instructions.json",
    });

    if (outputFiles.length === 0) {
      throw output_validate_errors.no_outputs_found();
    }

    const failures: ValidationFailure[] = [];

    for (const outputFile of outputFiles) {
      const name = outputFile.directory.name;
      const issues = await checkOutput({
        rootOutputDir: outputsFolder,
        currentOutputDir: outputFile.directory,
      });

      if (issues.length > 0) {
        failures.push({ name, issues });
      }
    }

    if (failures.length > 0) {
      cli.print(`Validation failed for ${failures.length} output(s):`);
      cli.print("");

      for (const { name, issues } of failures) {
        cli.print(`  ${name}:`);

        for (const issue of issues) {
          cli.print(`    - ${issue}`);
        }
      }

      cli.print("");
      throw output_validate_errors.validation_failed(failures.length);
    }

    cli.print(`Validated ${outputFiles.length} output(s). All valid.`);
  },
});

export default validate;