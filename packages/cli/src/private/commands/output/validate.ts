import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import createOutputCreateErrors from "#errors/outputCreateErrors";
import createOutputValidateErrors from "#errors/outputValidateErrors";
import { checkOutput } from "#utils/check-output";
import {
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  getDomainFolder,
} from "#constants";

interface ValidationFailure {
  name: string;
  issues: string[];
}

export default function createValidateCommand(domain: string): Command<readonly never[]> {
  const createErrors = createOutputCreateErrors(domain);
  const validateErrors = createOutputValidateErrors(domain);

  return new Command({
    name: "validate",
    description: `Validate ${domain} instructions.json files and templates`,
    flags: [
      {
        name: "name",
        long: "name",
        short: "n",
        description: `Validate only this ${domain}`,
      },
    ],
    subcommands: [],
    action: async ({ flags, context }) => {
      const root: FileRef = context?.root ?? await runtime.projectRoot();
      const mainFolder = root.append(`/${MAIN_FOLDER}`);
      const hasDryFolder = await fs.exists(mainFolder);

      if (!hasDryFolder) {
        throw createErrors.dry_folder_not_found();
      }

      const domainFolder = mainFolder.append(
        `/${OUTPUT_FOLDER}/${getDomainFolder(domain as "template" | "feature")}`,
      );
      const hasDomainFolder = await fs.exists(domainFolder);

      if (!hasDomainFolder) {
        throw validateErrors.no_outputs_found();
      }

      // Single-target path: validate one folder, throw on missing/invalid.
      if (is.defined(flags.name) === true) {
        const outputFolder = domainFolder.append(`/${flags.name}`);

        if (!(await fs.exists(outputFolder))) {
          throw validateErrors.not_found(flags.name);
        }

        const issues = await checkOutput({
          rootOutputDir: domainFolder,
          currentOutputDir: outputFolder,
        });

        if (issues.length > 0) {
          throw validateErrors.invalid(
            flags.name,
            issues.join("; "),
          );
        }

        cli.print(`${flags.name} is valid.`);
        return;
      }

      // All-targets path: discover every instructions.json, report per-file.
      const outputFiles = await domainFolder.files({
        recursive: true,
        filter: (file) => file.name === "instructions.json",
      });

      if (outputFiles.length === 0) {
        throw validateErrors.no_outputs_found();
      }

      const failures: ValidationFailure[] = [];

      for (const outputFile of outputFiles) {
        const name = outputFile.directory.name;
        const issues = await checkOutput({
          rootOutputDir: domainFolder,
          currentOutputDir: outputFile.directory,
        });

        if (issues.length > 0) {
          failures.push({ name, issues });
        }
      }

      if (failures.length > 0) {
        cli.print(`Validation failed for ${failures.length} ${domain}(s):`);
        cli.print("");

        for (const { name, issues } of failures) {
          cli.print(`  ${name}:`);

          for (const issue of issues) {
            cli.print(`    - ${issue}`);
          }
        }

        cli.print("");
        throw validateErrors.validation_failed(failures.length);
      }

      cli.print(`Validated ${outputFiles.length} ${domain}(s). All valid.`);
    },
  });
}