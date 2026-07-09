import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import output_create_errors from "#errors/outputCreateErrors";
import { outputSchema, type Instructions } from "#schemas/instruction";
import {
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  domainFolderMap,
} from "#constants";

export default function createCreateCommand(
  domain: "template" | "feature",
): Command<any> {
  const errors = output_create_errors[domain];

  return new Command({
    name: "create",
    description: `Create a new ${domain}`,
    flags: [
      {
        name: "name",
        long: "name",
        short: "n",
        description: `${domain} name`,
        required: true,
      },
      {
        name: "intent",
        long: "intent",
        short: "i",
        description: "Comma-separated intent strings",
      },
      {
        name: "variables",
        long: "variables",
        short: "v",
        description: "Comma-separated variable names",
      },
      {
        name: "output",
        long: "output",
        short: "o",
        description: "JSON output specification",
      },
    ],

    subcommands: [],

    action: async ({ flags, context }) => {
      const root: FileRef = context?.root ?? await runtime.projectRoot();
      const mainFolder = root.append(`/${MAIN_FOLDER}`);

      const hasMainFolder = await fs.exists(mainFolder);
      if (!hasMainFolder) {
        throw errors.dry_folder_not_found();
      }

      const name = flags.name!;
      const domainFolder = mainFolder.append(
        `/${OUTPUT_FOLDER}/${domainFolderMap[domain]}`,
      );

      // Ensure domain folder exists
      if (!(await fs.exists(domainFolder))) {
        await fs.create(domainFolder);
      }

      const outputFolder = domainFolder.append(`/${name}`);
      const outputPath = outputFolder.append("/instructions.json");

      const hasOutput = await fs.exists(outputFolder);
      if (hasOutput) {
        throw errors.already_exists(name);
      }

      await fs.create(outputFolder);

      const intent = is.defined(flags.intent) === true
        ? flags.intent.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      const variables = is.defined(flags.variables) === true
        ? flags.variables.split(",").map(s => s.trim()).filter(Boolean)
        : [];

      let output: Instructions["output"] = { create: [], modify: [], delete: [] };

      if (is.defined(flags.output) === true) {
        try {
          output = outputSchema.parse(JSON.parse(flags.output));
        } catch {
          throw errors.invalid_output_json();
        }
      }

      const instructions = { name, variables, intent, output };

      await outputPath.writeJSON(instructions as never);

      // Scaffold empty files for both create and modify entries
      for (const file of output.create) {
        if (is.defined(file.template) === true) {
          const templatePath = outputFolder.append(`/${file.template}`);

          const hasTemplate = await fs.exists(templatePath);
          if (!hasTemplate) {
            await templatePath.write("");
          }
        }
      }

      for (const file of output.modify) {
        if (is.defined(file.template) === true) {
          const templatePath = outputFolder.append(`/${file.template}`);

          const hasTemplate = await fs.exists(templatePath);
          if (!hasTemplate) {
            await templatePath.write("");
          }
        }
      }

      cli.print(`Created ${domain}: ${name}\n`);
    },
  });
}