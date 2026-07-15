import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import output_list_errors from "#errors/outputListErrors";
import { instructionsSchema } from "#schemas/instruction";
import {
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  domainFolderMap,
} from "#constants";

export default function createListCommand(
  domain: "template" | "feature",
): Command<any> {
  const errors = output_list_errors[domain];

  return new Command({
    name: "list",

    description: `List all ${domain}s`,

    flags: [],

    subcommands: [],

    action: async (props) => {
      const root: FileRef = props?.context?.root ?? await runtime.projectRoot();
      const mainFolder = root.append(`/${MAIN_FOLDER}`);

      if (!(await fs.exists(mainFolder))) {
        throw errors.dry_folder_not_found();
      }

      const domainFolder = mainFolder.append(
        `/${OUTPUT_FOLDER}/${domainFolderMap[domain]}`,
      );

      if (!(await fs.exists(domainFolder))) {
        throw errors.no_matching();
      }

      const outputFiles = await domainFolder.files({
        recursive: true,
        filter: (file) => file.name === "instructions.json",
      });

      if (outputFiles.length === 0) {
        throw errors.no_matching();
      }

      const names: string[] = [];

      for (const outputFile of outputFiles) {
        const instructions = instructionsSchema.parse(await outputFile.json());
        names.push(instructions.name);
      }

      for (const name of names) {
        cli.print(`${name}\n`);
      }
    },
  });
}