import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@dryai/program";
import generate_pattern_errors from "#errors/patternGenerateErrors";
import pattern_search_errors from "#errors/patternSearchErrors";
import tokenize from "#commands/pattern/tokenize";
import scoreIntent from "#commands/pattern/score-intent";
import { instructionsSchema } from "#schemas/instruction";
import { MAIN_FOLDER, PATTERNS_FOLDER } from "#constants";

interface SearchResult {
  name: string;
  score: number;
  fileCount: number;
}

const search = new Command({
  name: "search",
  description: "Search patterns by intent",
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
      throw generate_pattern_errors.dry_folder_not_found();
    }

    const patternsFolder = mainFolder.append(`/${PATTERNS_FOLDER}`);
    const hasPatternsFolder = await fs.exists(patternsFolder);

    if (!hasPatternsFolder) {
      throw pattern_search_errors.no_matching_patterns();
    }

    const query = is.defined(flags.query) && flags.query.length > 0
      ? flags.query
      : "";
    const queryKeywords = tokenize(query);

    if (queryKeywords.length === 0) {
      throw pattern_search_errors.no_matching_patterns();
    }

    const patternFiles = await patternsFolder.files({
      recursive: true,
      filter: (file) => file.name === "instructions.json",
    });

    if (patternFiles.length === 0) {
      throw pattern_search_errors.no_matching_patterns();
    }

    const results: SearchResult[] = [];

    for (const patternFile of patternFiles) {
      const pattern = instructionsSchema.parse(await patternFile.json());

      const score = scoreIntent(pattern, queryKeywords);

      if (score === 0) {
        continue;
      }

      results.push({
        name: pattern.name,
        score,
        fileCount: pattern.output.files.length,
      });
    }

    if (results.length === 0) {
      throw pattern_search_errors.no_matching_patterns();
    }

    results.sort((a, b) => b.score - a.score);

    cli.print(`Found ${results.length} matching pattern(s):`);
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
