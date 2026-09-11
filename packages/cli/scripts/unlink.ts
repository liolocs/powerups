#!/usr/bin/env bun
/**
 * Dev unlinker for @liolocs/powerups-cli — the inverse of scripts/link.ts.
 *
 * Run with bun (from anywhere in the repo):
 *
 *   bun run packages/cli/scripts/unlink.ts
 *
 * What it does:
 *   1. Reads CLI_CMD from src/private/constants.ts and the package name
 *      from packages/cli/package.json.
 *   2. Runs `pnpm uninstall --global <name>` — the documented inverse of
 *      `pnpm link --global`.
 *   3. Sweeps the pnpm global node_modules for leftover symlinks pointing
 *      at this package (e.g. links kept under older package names) and
 *      removes them.
 *   4. Removes <CLI_CMD> bin shims in the global `.bin` dir and in
 *      PNPM_HOME when they point into this package or are left dangling.
 *   5. Verifies with `which <CLI_CMD>` that the command is gone.
 *
 * Idempotent: safe to re-run. The committed `bin` field in package.json is
 * left untouched — it only matters when the package is installed, not for
 * the dev link. Link again with `bun run packages/cli/scripts/link.ts`.
 */
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import { readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { CLI_CMD } from "../src/private/constants.ts";

type PkgJson = {
  name?: string;
  [key: string]: unknown;
};

const log = (msg: string): void => void io.stdout.write(msg);

const SHIM_TARGET = /"\$basedir\/([^"]+)"/g;

export const insidePackage = (
  { target, packagePath }: { target: string; packagePath: string },
): boolean =>
  target === packagePath || target.startsWith(`${packagePath}${path.sep}`);

export const linkTarget = async ({ linkPath }: { linkPath: string }): Promise<string | undefined> =>
  await realpath(linkPath).catch(() => undefined);

export async function globalRoot(): Promise<string | undefined> {
  try {
    return (await io.run("pnpm root -g")).trim();
  } catch {
    return undefined;
  }
}

export async function removePackageLinks(
  { globalDir, packagePath }: { globalDir: string; packagePath: string },
): Promise<string[]> {
  const removed: string[] = [];
  const entries = await readdir(globalDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(globalDir, entry.name);

    if (entry.isSymbolicLink()) {
      const target = await linkTarget({ linkPath: entryPath });
      if (target !== undefined && insidePackage({ target, packagePath })) {
        await rm(entryPath);
        removed.push(entryPath);
      }
      continue;
    }

    if (!entry.isDirectory() || !entry.name.startsWith("@")) continue;

    const scopedEntries = await readdir(entryPath, { withFileTypes: true });
    for (const scopedEntry of scopedEntries) {
      const scopedPath = path.join(entryPath, scopedEntry.name);
      if (!scopedEntry.isSymbolicLink()) continue;
      const scopedTarget = await linkTarget({ linkPath: scopedPath });
      if (scopedTarget !== undefined && insidePackage({ target: scopedTarget, packagePath })) {
        await rm(scopedPath);
        removed.push(scopedPath);
      }
    }
    if ((await readdir(entryPath)).length === 0) {
      await rm(entryPath, { recursive: true });
      removed.push(entryPath);
    }
  }

  return removed;
}

export async function removeCommandShims(
  { shimDir, commandName, packagePath }: {
    shimDir: string;
    commandName: string;
    packagePath: string;
  },
): Promise<string[]> {
  const removed: string[] = [];
  const entries = await readdir(shimDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const shimPath = path.join(shimDir, entry.name);
    const content = await readFile(shimPath, "utf8").catch(() => "");
    const targets = [...content.matchAll(SHIM_TARGET)]
      .map((match) => path.resolve(shimDir, match[1]));

    const liveTarget = (await Promise.all(
      targets.map((target) => realpath(target).catch(() => undefined)),
    )).find((realPath) => realPath !== undefined);

    if (liveTarget !== undefined) {
      if (insidePackage({ target: liveTarget, packagePath })) {
        await rm(shimPath);
        removed.push(shimPath);
      }
      continue;
    }

    if (targets.length > 0 && entry.name === commandName) {
      await rm(shimPath);
      removed.push(shimPath);
    }
  }

  return removed;
}

export async function shimDirs({ globalDir }: { globalDir: string }): Promise<string[]> {
  const homeDir = process.env.PNPM_HOME ?? path.resolve(globalDir, "..", "..", "..");
  return [path.join(globalDir, ".bin"), homeDir];
}

async function uninstallGlobalLink(
  { packageName, packageDir }: { packageName: string; packageDir: string },
): Promise<void> {
  log(`• uninstalling global link for ${packageName} ...\n`);
  try {
    await (io.spawn(
      `pnpm uninstall --global ${packageName}`,
      { cwd: packageDir, inherit: true },
    ) as Promise<void>);
    log("✓ global link removed\n");
  } catch {
    log("• pnpm had nothing to uninstall (see output above) — continuing\n");
  }
}

async function verifyRemoved({ commandName }: { commandName: string }): Promise<void> {
  try {
    const leftover = await io.which(commandName);
    log(
      `⚠ ${commandName} is still on PATH → ${leftover}\n`
      + `  not managed by pnpm — remove it manually if unexpected.\n`,
    );
  } catch {
    log(`✓ ${commandName} is no longer available in the terminal\n`);
    log(`  link again with: bun run packages/cli/scripts/link.ts\n`);
  }
}

async function main(): Promise<void> {
  const packageDirRef = fs.ref(import.meta.dir).directory;
  const pkgJsonRef = packageDirRef.append("/package.json");

  if (!await pkgJsonRef.exists()) {
    throw new Error(`no package.json at ${pkgJsonRef.path}`);
  }

  const pkg = (await pkgJsonRef.json()) as PkgJson;
  const packagePath = await realpath(packageDirRef.path);

  if (pkg.name === undefined) {
    throw new Error("package.json has no name");
  }

  await uninstallGlobalLink({ packageName: pkg.name, packageDir: packageDirRef.path });

  const globalDir = await globalRoot();
  if (globalDir === undefined) {
    log("⚠ could not resolve the pnpm global dir (`pnpm root -g` failed)\n");
  } else {
    for (const removedLink of await removePackageLinks({ globalDir, packagePath })) {
      log(`✓ removed leftover link ${removedLink}\n`);
    }

    for (const shimDir of new Set(await shimDirs({ globalDir }))) {
      for (const removedShim of await removeCommandShims(
        { shimDir, commandName: CLI_CMD, packagePath },
      )) {
        log(`✓ removed leftover shim ${removedShim}\n`);
      }
    }
  }

  await verifyRemoved({ commandName: CLI_CMD });
}

if (import.meta.main) {
  await main();
}