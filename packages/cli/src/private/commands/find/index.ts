import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powers/program";
import gain_errors from "#errors/gainErrors";
import find_errors from "#errors/findErrors";
import tokenize from "#utils/tokenize";
import scoreIntent from "#utils/score-intent";
import { readConfig } from "#utils/config";
import { packageJsonSchema, type PackageJson } from "#schemas/package";
import { instructionsSchema } from "#schemas/instruction";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  GLOBAL_INTERNAL_PATH,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  type PowerType,
} from "#constants";

interface SearchResult {
  name: string;
  description: string;
  score: number;
  fileCount: number;
  type: PowerType;
  packageName: string;
  location: "local" | "global";
}

/**
 * Resolve a package to its directory and package.json.
 * Local first, then global. Returns null if not found.
 */
async function resolvePackageDir(
  root: FileRef,
  packageName: string,
): Promise<{ dir: FileRef; pkgJson: PackageJson; location: "local" | "global" } | null> {
  // Check local first
  const localDir = root.append(`/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`);
  if (await fs.exists(localDir)) {
    const pkgJsonPath = localDir.append(`/${PACKAGE_FILE}`);
    if (await fs.exists(pkgJsonPath)) {
      const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
      return { dir: localDir, pkgJson, location: "local" };
    }
  }

  // Check global
  const globalDir = fs.ref(`${GLOBAL_INTERNAL_PATH}/${packageName}`);
  if (await fs.exists(globalDir)) {
    const pkgJsonPath = globalDir.append(`/${PACKAGE_FILE}`);
    if (await fs.exists(pkgJsonPath)) {
      const pkgJson = packageJsonSchema.parse(await pkgJsonPath.json());
      return { dir: globalDir, pkgJson, location: "global" };
    }
  }

  return null;
}

const find = new Command({
  name: "find",
  description: "Find powers by intent across local and global packages",
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

    if (!(await fs.exists(mainFolder))) {
      throw gain_errors.dry_folder_not_found();
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
      ? (flags.type as PowerType)
      : undefined;
    const types: PowerType[] = typeFlag ? [typeFlag] : ["multi-use", "single-use"];

    // Read config to get list of packages
    const config = await readConfig(root);
    const packages = config?.packages ?? [];

    const results: SearchResult[] = [];

    for (const packageName of packages) {
      const pkgLoc = await resolvePackageDir(root, packageName);
      if (pkgLoc === null) continue;

      const active = pkgLoc.pkgJson.powers.active as Record<string, Record<string, string[]>>;

      for (const type of types) {
        const typeFolder = type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
        const powersMap = active[typeFolder];

        if (!is.defined(powersMap)) continue;

        for (const [powerKey, instructionPaths] of Object.entries(powersMap)) {
          // Skip parent:child entries — only search top-level powers
          if (powerKey.includes(":")) continue;

          const instructionPath = instructionPaths[0];
          const fullPath = pkgLoc.dir.append(`/${instructionPath}`);

          if (!(await fs.exists(fullPath))) continue;

          const output = instructionsSchema.parse(await fullPath.json());

          const score = scoreIntent(output, queryKeywords);
          if (score === 0) continue;

          results.push({
            name: output.name,
            description: output.description,
            score,
            fileCount: output.output.create.length + output.output.modify.length,
            type,
            packageName,
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

    cli.print(`Found ${results.length} matching power(s):\n`);
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