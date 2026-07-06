#!/usr/bin/env bun
/**
 * Dev linker for @saved/dry-cli.
 *
 * Run with bun (from anywhere in the repo):
 *
 *   bun run packages/saved-cli/scripts/link.ts
 *
 * What it does:
 *   1. Reads CLI_NAME from src/private/constants.ts.
 *   2. Writes `bin: { [CLI_NAME]: "./lib/bin.js" }` into packages/saved-cli/package.json
 *      (creating it if absent, correcting it if stale).
 *   3. Builds lib/bin.js if it doesn't already exist.
 *   4. Runs `pnpm link --global` from the package dir so `<CLI_NAME>` lands on PATH
 *      (via PNPM_HOME). The link is a symlink into this package, so every rebuild
 *      is picked up live — no re-link needed after source changes.
 *   5. Verifies with `which <CLI_NAME>`.
 *
 * Idempotent: safe to re-run. If you edit source, just re-run the build
 * (`pnpm --filter @saved/dry-cli build`); the global symlink already points here.
 */
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import { CLI_NAME } from "../src/private/constants.ts";

type PkgJson = {
  name?: string;
  version?: string;
  bin?: Record<string, string>;
  [key: string]: unknown;
};

const BIN_TARGET = "./lib/bin.js";
const INDENT = 2;

const log = (msg: string): void => void io.stdout.write(msg);

/** Run a shell command with inherited stdio (live output), in a given cwd. */
async function run(command: string, cwd: string): Promise<void> {
  try {
    // io.spawn returns a Promise<void> when { inherit: true }
    await (io.spawn(command, { cwd, inherit: true }) as Promise<void>);
  } catch (exitCode) {
    log(`\n✗ command failed: \`${command}\` (exit ${exitCode})\n`);
    throw new Error(`${command} exited with ${exitCode}`);
  }
}

async function main(): Promise<void> {
  // packages/saved-cli — the parent of this scripts/ directory.
  const pkgDir = fs.ref(import.meta.dir).directory;
  const pkgJsonRef = pkgDir.append("/package.json");

  if (!await pkgJsonRef.exists()) {
    throw new Error(`no package.json at ${pkgJsonRef.path}`);
  }

  // 1. Read the current package.json.
  const pkg = (await pkgJsonRef.json()) as PkgJson;
  const desired = { [CLI_NAME]: BIN_TARGET };
  const hadBin = pkg.bin !== undefined;
  const matches =
    hadBin && pkg.bin![CLI_NAME] === BIN_TARGET
      && Object.keys(pkg.bin!).length === 1;

  // 2. Set / correct the bin field.
  pkg.bin = desired;
  await pkgJsonRef.write(`${JSON.stringify(pkg, null, INDENT)}\n`);
  log(
    `${matches ? "✓ bin already correct" : hadBin ? "✓ bin updated" : "✓ bin added"}`
    + ` → { "${CLI_NAME}": "${BIN_TARGET}" }\n`,
  );

  // 3. Ensure the compiled entry exists; build if missing.
  const binRef = pkgDir.append("/lib/bin.js");
  if (await binRef.exists()) {
    log("✓ lib/bin.js already built (rebuild with `pnpm --filter @saved/dry-cli build`)\n");
  } else {
    log("• building lib/bin.js ...\n");
    await run("pnpm run build", pkgDir.path);
    log("✓ build complete\n");
  }

  // 4. Link globally so <CLI_NAME> is on PATH (via PNPM_HOME).
  log(`• linking ${pkg.name ?? "@saved/dry-cli"} globally ...\n`);
  await run("pnpm link --global", pkgDir.path);

  // 5. Verify it resolved on PATH.
  try {
    const linked = await io.which(CLI_NAME);
    log(`✓ ${CLI_NAME} -> ${linked}\n`);
    log(`  try:  ${CLI_NAME} --version\n`);
  } catch {
    log(
      `⚠ ${CLI_NAME} linked, but \`which ${CLI_NAME}\` found nothing.\n`
      + `  ensure PNPM_HOME is on your PATH (it is the pnpm global bin dir).\n`,
    );
  }
}

await main();