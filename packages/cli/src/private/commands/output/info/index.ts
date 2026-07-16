import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import output_info_errors from "#errors/outputInfoErrors";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { toKebabCase } from "#utils/variables";
import {
  CLI_NAME,
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  domainFolderMap,
} from "#constants";

export default function createInfoCommand(
  domain: "template" | "feature",
): Command<any> {
  const errors = output_info_errors[domain];

  return new Command({
    name: "info",
    description: `Show how to use a ${domain}`,
    flags: [],
    subcommands: [],
    action: async ({ subcommands, context }) => {
      // 1. Get name from positional args
      const name = subcommands?.[0];
      if (!is.defined(name)) {
        throw errors.missing_name();
      }

      // 2. Locate .saved folder
      const root: FileRef = context?.root ?? await runtime.projectRoot();
      const mainFolder = root.append(`/${MAIN_FOLDER}`);
      if (!(await fs.exists(mainFolder))) {
        throw errors.dry_folder_not_found();
      }

      // 3. Resolve domain folder
      const domainFolder = mainFolder.append(
        `/${OUTPUT_FOLDER}/${domainFolderMap[domain]}`,
      );
      const outputFolder = domainFolder.append(`/${name}`);
      if (!(await fs.exists(outputFolder))) {
        throw errors.not_found(name);
      }

      // 4. Load & parse instructions
      const outputPath = outputFolder.append("/instructions.json");
      const instructions = instructionsSchema.parse(await outputPath.json());

      // 5. Format & print (basic version — variables, files, deps, includes added later)
      const lines: string[] = [];

      // Header
      lines.push(`# ${instructions.name}`);
      lines.push("");
      lines.push(instructions.description);
      lines.push("");

      // Intent
      if (instructions.intent.length > 0) {
        lines.push("## Intent");
        lines.push("");
        lines.push(instructions.intent.join(", "));
        lines.push("");
      }

      // Variables
      const hasRequired = instructions.variables.required.length > 0;
      const hasOptional = (instructions.variables.optional ?? []).length > 0;
      if (hasRequired || hasOptional) {
        lines.push("## Variables");
        lines.push("");
        if (hasRequired) {
          lines.push("### Required");
          lines.push("");
          for (const v of instructions.variables.required) {
            lines.push(`- \`--${toKebabCase(v)}=<value>\``);
          }
          lines.push("");
        }
        if (hasOptional) {
          lines.push("### Optional");
          lines.push("");
          for (const v of instructions.variables.optional!) {
            lines.push(`- \`--${toKebabCase(v)}=<value>\``);
          }
          lines.push("");
        }
      }

      // Usage
      lines.push("## Usage");
      lines.push("");
      lines.push("```");
      const requiredFlags = instructions.variables.required
        .map(v => `--${toKebabCase(v)}=<value>`)
        .join(" ");
      const optionalFlags = (instructions.variables.optional ?? [])
        .map(v => `[--${toKebabCase(v)}=<value>]`)
        .join(" ");
      let cmd = `${CLI_NAME} ${domain} apply ${instructions.name}`;
      if (requiredFlags) cmd += ` ${requiredFlags}`;
      if (optionalFlags) cmd += ` ${optionalFlags}`;
      lines.push(cmd);
      lines.push("```");

      cli.print(`${lines.join("\n")}\n`);
    },
  });
}