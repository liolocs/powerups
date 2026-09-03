#!/usr/bin/env bun
/**
 * Generate the root README.md for the powerups monorepo.
 *
 * Scans each package's `package.json` under `packages/` — the `apps/`
 * directory is excluded — and renders `scripts/templates/root-readme.njk`
 * into the root `README.md`: one succinct entry per package — name, one-line
 * description, publish status — with a link to the package's own README. The
 * template also carries the static prose (how packages relate, tooling,
 * getting started, contributing), so the whole readme regenerates from one
 * template plus the package manifests.
 *
 * Run from the repo root:
 *   bun run scripts/generate-root-readme.ts
 */
import { exists, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nunjucks from "nunjucks";

const ROOT_DIR = path.resolve(import.meta.dir, "..");
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");
const TEMPLATE_PATH = path.join(
  ROOT_DIR, "scripts", "templates", "root-readme.njk",
);
const README_PATH = path.join(ROOT_DIR, "README.md");

type PackageJson = {
  name?: string;
  description?: string;
  private?: boolean;
};

type PackageSummary = {
  name: string;
  description: string;
  isPrivate: boolean;
  path: string;
  readmeHref: string;
};

const collectPackageSummaries = async (): Promise<PackageSummary[]> => {
  const entries = await readdir(PACKAGES_DIR, { withFileTypes: true });
  const summaries: PackageSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const packageJsonPath = path.join(PACKAGES_DIR, entry.name, "package.json");
    const hasPackageJson = await exists(packageJsonPath);

    if (hasPackageJson === false) continue;

    const packageJsonRaw = await readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonRaw) as PackageJson;

    summaries.push({
      name: packageJson.name ?? entry.name,
      description: packageJson.description ?? "",
      isPrivate: packageJson.private === true,
      path: `packages/${entry.name}`,
      readmeHref: `./packages/${entry.name}/README.md`,
    });
  }

  return summaries.sort((first, second) =>
    first.path.localeCompare(second.path));
};

const collapseBlankLines = (markdown: string): string =>
  markdown.replace(/\n{3,}/g, "\n\n");

const main = async (): Promise<void> => {
  const packages = await collectPackageSummaries();

  const template = await readFile(TEMPLATE_PATH, "utf8");
  const nunjucksEnvironment = new nunjucks.Environment(undefined, {
    autoescape: false,
  });
  const rendered = nunjucksEnvironment.renderString(template, { packages });
  const readme = collapseBlankLines(rendered);

  await writeFile(README_PATH, readme, "utf8");
  const relativePath = path.relative(ROOT_DIR, README_PATH);
  console.log(`✓ generated ${relativePath} from ${packages.length} packages`);
};

await main();
