#!/usr/bin/env bun
/**
 * Generate this package's README.md from the CLI's command definitions.
 *
 * The command registry in `lib/commands/index.js` (built from
 * `src/private/commands/<name>/index.ts`) is the single source of truth:
 * each command's `name`, `description`, `flags`, and `subcommands` flow
 * into the "## Commands" section of `scripts/templates/readme.njk`. The
 * template also carries the static prose (intro, install, quick start,
 * concepts), so the whole readme regenerates from one template plus live
 * command metadata.
 *
 * Requires a fresh build — run before this script:
 *
 *   pnpm --filter @liolocs/powerups-cli build
 *
 * Run from the package dir (`packages/cli`):
 *   bun run scripts/generate-readme.ts
 */
import { exists, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nunjucks from "nunjucks";
import type { Command, Flag } from "@liolocs/program";
import { CLI_CMD } from "../src/private/constants.ts";

const PKG_DIR = path.resolve(import.meta.dir, "..");
const COMMAND_REGISTRY_PATH = path.join(
  PKG_DIR, "lib", "commands", "index.js",
);
const TEMPLATE_PATH = path.join(PKG_DIR, "scripts", "templates", "readme.njk");
const README_PATH = path.join(PKG_DIR, "README.md");

type FlagMetadata = {
  long: string;
  short: string;
  description: string;
  required: boolean;
  type?: "boolean" | "string";
};

type CommandMetadata = {
  name: string;
  description: string;
  flags: FlagMetadata[];
  subcommandNames: string[];
};

const collapseBlankLines = (markdown: string): string =>
  markdown.replace(/\n{3,}/g, "\n\n");

const collectCommandMetadata = ({
  commandList,
}: {
  commandList: Command<any>[];
}): CommandMetadata[] =>
  commandList.map((command) => ({
    name: command.name,
    description: command.description,
    flags: command.flags.map((flag: Flag) => ({
      long: flag.long,
      short: flag.short,
      description: flag.description,
      required: flag.required ?? false,
      type: flag.type,
    })),
    subcommandNames: [...command.subcommands.keys()],
  }));

const main = async (): Promise<void> => {
  const registryExists = await exists(COMMAND_REGISTRY_PATH);

  if (registryExists === false) {
    const registryName = path.relative(PKG_DIR, COMMAND_REGISTRY_PATH);
    console.error(`✗ ${registryName} not found.`);
    console.error("  build the CLI first: pnpm --filter @liolocs/powerups-cli build");
    process.exit(1);
  }

  const registry = (await import(COMMAND_REGISTRY_PATH)) as {
    default: Command<any>[];
  };
  const commands = collectCommandMetadata({ commandList: registry.default });

  const template = await readFile(TEMPLATE_PATH, "utf8");
  const nunjucksEnvironment = new nunjucks.Environment(undefined, {
    autoescape: false,
  });
  const readme = collapseBlankLines(
    nunjucksEnvironment.renderString(template, { cliCmd: CLI_CMD, commands }),
  );

  await writeFile(README_PATH, readme, "utf8");
  const relativePath = path.relative(PKG_DIR, README_PATH);
  console.log(`✓ generated ${relativePath} from ${commands.length} commands`);
};

await main();
