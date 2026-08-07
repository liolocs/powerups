import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@liolocs/program";
import create_errors from "#errors/createErrors";
import find_errors from "#errors/findErrors";
import tokenize from "#utils/tokenize";
import scoreIntent from "#utils/score-intent";
import { readConfig, normalizePackageEntry } from "#utils/config";
import { resolvePackage } from "#utils/resolve-powerup";
import { instructionsSchema } from "#schemas/instruction";
import {
  CLI_NAME,
  CLI_FOLDER_NAME,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  SINGULAR_NAME_FOR_CLI,
  type PowerUpType,
} from "#constants";

interface SearchResult {
  name: string;
  description: string;
  score: number;
  fileCount: number;
  type: PowerUpType;
  packageName: string;
  location: "local" | "global";
}

const find = new Command({
  name: "find",
  description: "Find powerups by intent across local and global packages",
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
      description: "Filter by type (multi-use or single-use)",
    },
  ],
  subcommands: [],
  action: async ({ flags, context }) => {
    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const mainFolder = root.append(`/${CLI_FOLDER_NAME}`);

    if (!(await fs.exists(mainFolder))) {
      throw create_errors.main_folder_not_found();
    }

    const query = is.defined(flags.query) && flags.query.length > 0
      ? flags.query
      : "";
    const queryKeywords = tokenize(query);

    if (queryKeywords.length === 0) {
      throw find_errors.no_query();
    }

    // Determine which types to search
    const typeFlag = is.defined(flags.type)
      ? (flags.type as PowerUpType)
      : undefined;
    const types: PowerUpType[] = typeFlag ? [typeFlag] : ["multi-use", "single-use"];

    // Read config to get list of packages
    const config = await readConfig(root);
    const packages = config?.packages ?? [];

    const results: SearchResult[] = [];

    for (const entry of packages) {
      const normalized = normalizePackageEntry(entry);
      const pkgLoc = await resolvePackage(root, normalized.package);
      if (pkgLoc === null) continue;

      const active = pkgLoc[CLI_NAME].active as Record<string, Record<string, string>>;
      const filter = normalized.powerups;

      for (const type of types) {
        const typeFolder = type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
        const powersMap = active[typeFolder];

        if (!is.defined(powersMap)) continue;

        for (const [powerKey, instructionPath] of Object.entries(powersMap)) {
          // Skip parent:child entries — only search top-level powerups
          if (powerKey.includes(":")) continue;

          // Apply include filter
          if (is.defined(filter?.include) && !filter!.include!.includes(powerKey)) {
            continue;
          }

          // Apply exclude filter
          if (is.defined(filter?.exclude) && filter!.exclude!.includes(powerKey)) {
            continue;
          }

          const fullPath = pkgLoc.packageDir.append(`/${instructionPath}`);

          if (!(await fs.exists(fullPath))) continue;

          const output = instructionsSchema.parse(await fullPath.json());

          const score = scoreIntent(output, queryKeywords);
          if (score === 0) continue;

          results.push({
            name: output.name,
            description: output.description,
            score,
            fileCount: output.steps.filter(s => s.type === "create" || s.type === "modify").length,
            type,
            packageName: pkgLoc.packageName,
            location: pkgLoc.location,
          });
        }
      }
    }

    if (results.length === 0) {
      throw find_errors.no_matching();
    }

    // Sort: local first, then by score
    results.sort((a, b) => {
      if (a.location !== b.location) {
        return a.location === "local" ? -1 : 1;
      }
      return b.score - a.score;
    });

    cli.print(`Found ${results.length} matching ${SINGULAR_NAME_FOR_CLI}(s):\n`);
    cli.print("Local first, highest rank first\n");
    cli.print("\n");

    results.forEach((result, index) => {
      const score_text = `score: ${result.score}`;
      const files_text = `files: ${result.fileCount}`;
      const loc_text = result.location;
      const pkg_text = `pkg: ${result.packageName}`;
      const meta_text = `(${score_text}, ${files_text}, ${pkg_text}, ${loc_text})`;
      cli.print(`  [${index + 1}] ${result.name} (${result.type}) ${meta_text}\n`);
      cli.print(`      ${result.description}\n`);
    });
  },
});

export default find;