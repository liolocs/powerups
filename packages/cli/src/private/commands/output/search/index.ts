import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import output_create_errors from "#errors/outputCreateErrors";
import output_search_errors from "#errors/outputSearchErrors";
import tokenize from "#utils/tokenize";
import scoreIntent from "#utils/score-intent";
import { instructionsSchema } from "#schemas/instruction";
import {
  MAIN_FOLDER,
  OUTPUT_FOLDER,
  domainFolderMap,
} from "#constants";

interface SearchResult {
  name: string;
  score: number;
  fileCount: number;
}

export default function createSearchCommand(
  domain: "template" | "feature",
): Command<any> {
  const createErrors = output_create_errors[domain];
  const searchErrors = output_search_errors[domain];

  return new Command({
    name: "search",

    description: `Search ${domain}s by intent`,

    flags: [
      {
        name: "query",
        long: "query",
        short: "q",
        description: "Search query (space-separated keywords)",
      },
    ],

    subcommands: [],

    action: async ({ flags, context }) => {
      const root: FileRef = context?.root ?? await runtime.projectRoot();
      const mainFolder = root.append(`/${MAIN_FOLDER}`);

      const hasMainFolder = await fs.exists(mainFolder);
      if (!hasMainFolder) {
        throw createErrors.dry_folder_not_found();
      }

      const query = is.defined(flags.query) && flags.query.length > 0
        ? flags.query
        : "";
      const queryKeywords = tokenize(query);

      if (queryKeywords.length === 0) {
        throw searchErrors.no_query();
      }

      const domainFolder = mainFolder.append(
        `/${OUTPUT_FOLDER}/${domainFolderMap[domain]}`,
      );

      const hasDomainFolder = await fs.exists(domainFolder);
      if (!hasDomainFolder) {
        throw searchErrors.no_matching();
      }

      const outputFiles = await domainFolder.files({
        recursive: true,
        filter: (file) => file.name === "instructions.json",
      });

      if (outputFiles.length === 0) {
        throw searchErrors.no_matching();
      }

      const results: SearchResult[] = [];

      for (const outputFile of outputFiles) {
        const output = instructionsSchema.parse(await outputFile.json());

        const score = scoreIntent(output, queryKeywords);

        if (score === 0) {
          continue;
        }

        results.push({
          name: output.name,
          score,
          fileCount: output.output.create.length + output.output.modify.length,
        });
      }

      if (results.length === 0) {
        throw searchErrors.no_matching();
      }

      results.sort((a, b) => b.score - a.score);

      cli.print(`Found ${results.length} matching ${domain}(s):\n`);
      cli.print("Highest rank first\n");
      cli.print("\n");

      results.forEach((result, index) => {
        const score_text = `score: ${result.score}`;
        const files_text = `files: ${result.fileCount}`;
        const score_and_files_text = `(${score_text}, ${files_text})`;
        cli.print(`  [${index + 1}] ${result.name} ${score_and_files_text}\n`);
      });
    },
  });
}