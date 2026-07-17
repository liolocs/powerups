import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powers/program";
import create_errors from "#errors/createErrors";
import search_errors from "#errors/searchErrors";
import tokenize from "#utils/tokenize";
import scoreIntent from "#utils/score-intent";
import { instructionsSchema } from "#schemas/instruction";
import {
  MAIN_FOLDER,
  ACTIVE_FOLDER,
  powerFolderMap,
  type PowerType,
} from "#constants";

interface SearchResult {
  name: string;
  description: string;
  score: number;
  fileCount: number;
  type: PowerType;
}

const search = new Command({
  name: "search",

  description: "Search powers by intent",

  flags: [
    {
      name: "query",
      long: "query",
      short: "q",
      description: "Search query (space-separated keywords)",
    },
    {
      name: "type",
      long: "type",
      short: "t",
      description: "Filter by power type (multi-use or single-use)",
    },
  ],

  subcommands: [],

  action: async ({ flags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${MAIN_FOLDER}`);

    const hasMainFolder = await fs.exists(mainFolder);
    if (!hasMainFolder) {
      throw create_errors.dry_folder_not_found();
    }

    const query = is.defined(flags.query) && flags.query.length > 0
      ? flags.query
      : "";
    const queryKeywords = tokenize(query);

    if (queryKeywords.length === 0) {
      throw search_errors.no_query();
    }

    // Determine which types to search
    const typeFlag = is.defined(flags.type)
      ? (flags.type as PowerType)
      : undefined;
    const types: PowerType[] = typeFlag
      ? [typeFlag]
      : ["multi-use", "single-use"];

    const results: SearchResult[] = [];

    for (const type of types) {
      const typeFolder = mainFolder.append(
        `/${ACTIVE_FOLDER}/${powerFolderMap[type]}`,
      );

      const hasTypeFolder = await fs.exists(typeFolder);
      if (!hasTypeFolder) {
        continue;
      }

      const outputFiles = await typeFolder.files({
        recursive: true,
        filter: (file) => file.name === "instructions.json",
      });

      for (const outputFile of outputFiles) {
        const output = instructionsSchema.parse(await outputFile.json());

        const score = scoreIntent(output, queryKeywords);

        if (score === 0) {
          continue;
        }

        results.push({
          name: output.name,
          description: output.description,
          score,
          fileCount: output.output.create.length + output.output.modify.length,
          type,
        });
      }
    }

    if (results.length === 0) {
      throw search_errors.no_matching();
    }

    results.sort((a, b) => b.score - a.score);

    cli.print(`Found ${results.length} matching power(s):\n`);
    cli.print("Highest rank first\n");
    cli.print("\n");

    results.forEach((result, index) => {
      const score_text = `score: ${result.score}`;
      const files_text = `files: ${result.fileCount}`;
      const score_and_files_text = `(${score_text}, ${files_text})`;
      cli.print(`  [${index + 1}] ${result.name} (${result.type}) ${score_and_files_text}\n`);
      cli.print(`      ${result.description}\n`);
    });
  },
});

export default search;