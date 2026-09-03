#!/usr/bin/env bun
/**
 * Generate the docs website's content from the monorepo sources.
 *
 * The Starlight pages under `src/content/docs/` are generated artifacts:
 *
 *   reference/cli/<name>.md   one page per `pup` command, from the built
 *                             command registry in packages/cli
 *                             (`lib/commands/index.js`, built from
 *                             `src/private/commands/<name>/index.ts`)
 *   reference/sdk.md          rendered from packages/sdk/README.md — the
 *                             maintained single source of truth for the SDK API
 *   index.mdx, guides/*.md    prose carried by njk templates in
 *                             `scripts/templates/`
 *
 * Requires a fresh packages build — run before this script:
 *
 *   pnpm --filter @liolocs/powerups-cli build
 *
 * Run from the app dir (`apps/docs-website`):
 *   bun run scripts/generate-docs.ts
 */
import { exists, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import nunjucks from "nunjucks";
import { CLI_CMD } from "../../../packages/cli/src/private/constants.ts";

const APP_DIR = path.resolve(import.meta.dir, "..");
const CLI_REGISTRY_PATH = path.join(
  APP_DIR, "..", "..", "packages", "cli", "lib", "commands", "index.js",
);
const SDK_README_PATH = path.join(
  APP_DIR, "..", "..", "packages", "sdk", "README.md",
);
const DOCS_DIR = path.join(APP_DIR, "src", "content", "docs");
const GUIDES_DIR = path.join(DOCS_DIR, "guides");
const TEMPLATES_DIR = path.join(APP_DIR, "scripts", "templates");
const CLI_REFERENCE_DIR = path.join(DOCS_DIR, "reference", "cli");
const SDK_REFERENCE_PATH = path.join(DOCS_DIR, "reference", "sdk.md");

type FlagRecord = {
  long: string;
  short: string;
  description: string;
  required?: boolean;
  type?: "boolean" | "string";
};

type CommandRecord = {
  name: string;
  description: string;
  flags: FlagRecord[];
  subcommands: Map<string, unknown>;
};

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

type StaticPage = {
  templateName: string;
  outputPath: string;
};

const STATIC_PAGES: StaticPage[] = [
  {
    templateName: "index.mdx.njk",
    outputPath: path.join(DOCS_DIR, "index.mdx"),
  },
  {
    templateName: "guide-install.md.njk",
    outputPath: path.join(GUIDES_DIR, "install.md"),
  },
  {
    templateName: "guide-quick-start.md.njk",
    outputPath: path.join(GUIDES_DIR, "quick-start.md"),
  },
  {
    templateName: "guide-authoring.md.njk",
    outputPath: path.join(GUIDES_DIR, "authoring-powerups.md"),
  },
];

const nunjucksEnvironment = new nunjucks.Environment(undefined, {
  autoescape: false,
});

const collapseBlankLines = (markdown: string): string =>
  markdown.replace(/\n{3,}/g, "\n\n");

const renderTemplate = async ({
  templateName,
  variables,
}: {
  templateName: string;
  variables: Record<string, unknown>;
}): Promise<string> => {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  const template = await readFile(templatePath, "utf8");
  const rendered = nunjucksEnvironment.renderString(template, variables);
  return collapseBlankLines(rendered);
};

const collectCommandMetadata = ({
  commandList,
}: {
  commandList: CommandRecord[];
}): CommandMetadata[] =>
  commandList.map((command) => ({
    name: command.name,
    description: command.description,
    flags: command.flags.map((flag: FlagRecord) => ({
      long: flag.long,
      short: flag.short,
      description: flag.description,
      required: flag.required ?? false,
      type: flag.type,
    })),
    subcommandNames: [...command.subcommands.keys()],
  }));

const generateCliReference = async ({
  commandList,
}: {
  commandList: CommandRecord[];
}): Promise<number> => {
  const commandMetadata = collectCommandMetadata({ commandList });

  await rm(CLI_REFERENCE_DIR, { recursive: true, force: true });
  await mkdir(CLI_REFERENCE_DIR, { recursive: true });

  for (const [orderIndex, command] of commandMetadata.entries()) {
    const page = await renderTemplate({
      templateName: "cli-command.md.njk",
      variables: { cliCmd: CLI_CMD, command, order: orderIndex + 1 },
    });
    await writeFile(
      path.join(CLI_REFERENCE_DIR, `${command.name}.md`),
      page,
      "utf8",
    );
  }

  return commandMetadata.length;
};

const generateSdkReference = async (): Promise<void> => {
  const sdkReadme = await readFile(SDK_README_PATH, "utf8");
  const sdkContent = sdkReadme.replace(/^# [^\n]*\n+/, "");
  const page = await renderTemplate({
    templateName: "sdk-reference.md.njk",
    variables: { sdkContent },
  });
  await writeFile(SDK_REFERENCE_PATH, page, "utf8");
};

const generateStaticPages = async (): Promise<void> => {
  for (const staticPage of STATIC_PAGES) {
    const page = await renderTemplate({
      templateName: staticPage.templateName,
      variables: {},
    });
    await writeFile(staticPage.outputPath, page, "utf8");
  }
};

const main = async (): Promise<void> => {
  const registryExists = await exists(CLI_REGISTRY_PATH);

  if (registryExists === false) {
    const registryName = path.relative(APP_DIR, CLI_REGISTRY_PATH);
    console.error(`✗ ${registryName} not found.`);
    console.error(
      "  build the packages first: pnpm --filter @liolocs/powerups-cli build",
    );
    process.exit(1);
  }

  const registry = (await import(CLI_REGISTRY_PATH)) as {
    default: CommandRecord[];
  };
  const commandCount = await generateCliReference({
    commandList: registry.default,
  });
  await generateSdkReference();
  await generateStaticPages();

  const summary =
    `${commandCount} CLI command pages, SDK reference, guides, landing`;
  console.log(`✓ generated docs content: ${summary}`);
};

await main();
