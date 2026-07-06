import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generate_pattern_errors from "#errors/patternGenerateErrors";
import { outputSchema, type Instructions } from "#schemas/instruction";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

const generate = new Command({
  name: "gen",

  description: "Generate a new pattern file",

  flags: [
    {
      name: "name",
      long: "name",
      short: "n",
      description: "Pattern name",
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
      throw generate_pattern_errors.dry_folder_not_found();
    }

    const name = flags.name!;
    const patternsFolder = mainFolder.append(`/${PATTERNS_FOLDER}`);
    const patternFolder = patternsFolder.append(`/${name}`);
    const patternPath = patternFolder.append("/instructions.json");
    const hasPattern = await fs.exists(patternFolder);

    if (hasPattern) {
      throw generate_pattern_errors.pattern_already_exists(name);
    }

    await fs.create(patternFolder);

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
        throw generate_pattern_errors.invalid_output_json();
      }
    }

    const instructions = { name, variables, intent, output };
    await patternPath.writeJSON(instructions);

    for (const file of is.array(output.files) === true ? output.files : []) {
      if (is.defined(file.template) === true) {
        const templatePath = patternFolder.append(`/${file.template}`);
        const hasTemplate = await fs.exists(templatePath);
        if (!hasTemplate) {
          await templatePath.write("");
        }
      }
    }

    cli.print(`Generated pattern: ${name}`);
  },
});

export default generate;
