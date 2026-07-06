import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import generate_output_errors from "#errors/outputGenerateErrors";
import { outputSchema, type Instructions } from "#schemas/instruction";
import { MAIN_FOLDER, OUTPUTS_FOLDER } from "#constants";

const generate = new Command({
  name: "gen",

  description: "Generate a new output file",

  flags: [
    {
      name: "name",
      long: "name",
      short: "n",
      description: "Output name",
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
    const hasDryFolder = await fs.exists(mainFolder);

    if (!hasDryFolder) {
      throw generate_output_errors.dry_folder_not_found();
    }

    const name = flags.name!;
    const outputsFolder = mainFolder.append(`/${OUTPUTS_FOLDER}`);
    const outputFolder = outputsFolder.append(`/${name}`);
    const outputPath = outputFolder.append("/instructions.json");
    const hasOutput = await fs.exists(outputFolder);

    if (hasOutput) {
      throw generate_output_errors.output_already_exists(name);
    }

    await fs.create(outputFolder);

    const intent = is.defined(flags.intent) === true
      ? flags.intent.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const variables = is.defined(flags.variables) === true
      ? flags.variables.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    let output: Instructions["output"] = { files: [] };

    if (is.defined(flags.output) === true) {
      try {
        output = outputSchema.parse(JSON.parse(flags.output));
      } catch {
        throw generate_output_errors.invalid_output_json();
      }
    }

    const instructions = { name, variables, intent, output };
    await outputPath.writeJSON(instructions);

    for (const file of is.array(output.files) === true ? output.files : []) {
      if (is.defined(file.template) === true) {
        const templatePath = outputFolder.append(`/${file.template}`);
        const hasTemplate = await fs.exists(templatePath);
        if (!hasTemplate) {
          await templatePath.write("");
        }
      }
    }

    cli.print(`Generated output: ${name}`);
  },
});

export default generate;
