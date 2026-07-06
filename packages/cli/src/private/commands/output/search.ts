import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@saved/program";
import generate_output_errors from "#errors/outputGenerateErrors";
import output_search_errors from "#errors/outputSearchErrors";
import tokenize from "#commands/output/tokenize";
import scoreIntent from "#commands/output/score-intent";
import { instructionsSchema } from "#schemas/instruction";
import { MAIN_FOLDER, OUTPUTS_FOLDER } from "#constants";

interface SearchResult {
  name: string;
  score: number;
  fileCount: number;
}

const search = new Command({
  name: "search",
  description: "Search outputs by intent",
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
    const hasDryFolder = await fs.exists(mainFolder);

    if (!hasDryFolder) {
      throw generate_output_errors.dry_folder_not_found();
    }

    const outputsFolder = mainFolder.append(`/${OUTPUTS_FOLDER}`);
    const hasOutputsFolder = await fs.exists(outputsFolder);

    if (!hasOutputsFolder) {
      throw output_search_errors.no_matching_outputs();
    }

    const query = is.defined(flags.query) && flags.query.length > 0
      ? flags.query
      : "";
    const queryKeywords = tokenize(query);

    if (queryKeywords.length === 0) {
      throw output_search_errors.no_matching_outputs();
    }

    const outputFiles = await outputsFolder.files({
      recursive: true,
      filter: (file) => file.name === "instructions.json",
    });

    if (outputFiles.length === 0) {
      throw output_search_errors.no_matching_outputs();
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
        fileCount: output.output.files.length,
      });
    }

    if (results.length === 0) {
      throw output_search_errors.no_matching_outputs();
    }

    results.sort((a, b) => b.score - a.score);

    cli.print(`Found ${results.length} matching output(s):`);
    cli.print("Highest rank first");
    cli.print("");

    results.forEach((result, index) => {
      const score_text = `score: ${result.score}`;
      const files_text = `files: ${result.fileCount}`;
      const score_and_files_text = `(${score_text}, ${files_text})`;
      cli.print(`  [${index + 1}] ${result.name} ${score_and_files_text}`);
    });
  },
});

export default search;
