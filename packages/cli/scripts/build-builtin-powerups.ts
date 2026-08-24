#!/usr/bin/env bun
/**
 * Build the CLI's built-in powerups into `lib/private/builtin/<name>/`.
 *
 * Built-in powerups ship inside the published CLI so commands like `pup create`
 * work anywhere — without requiring the powerup to be installed/registered.
 *
 * Unlike `pup build` (which operates on cwd and needs `pup` on PATH), this
 * script generates the dist directly from source so the CLI build never depends
 * on `pup` being linked. This avoids a bootstrap circle: `pnpm run local` runs
 * `build:packages` (→ this script) *before* `link.ts` puts `pup` on PATH.
 *
 * Produces, for each builtin:
 *   lib/private/builtin/<name>/dist/instructions.json   (from index.ts)
 *   lib/private/builtin/<name>/dist/templates/*.ts       (copied verbatim)
 *   lib/private/builtin/<name>/package.json              (copied verbatim)
 *
 * Run from the package dir (`packages/cli`):
 *   bun run scripts/build-builtin-powerups.ts
 */
import path from "node:path";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { exists } from "node:fs/promises";
import type { Instructions, Step } from "@liolocs/powerups-sdk";

const PKG_DIR = path.resolve(import.meta.dir, "..");

// <name, source dir relative to packages/cli>
const BUILTINS: ReadonlyArray<readonly [name: string, src: string]> = [
  ["create-powerup", ".powerups/installed/_internal/create-powerup"],
];

type DefinedInstructions = { instructions: Instructions; source: string };

function stripSource(steps: Step[]): Step[] {
  return steps.map(step => {
    const { __source: _omit, ...rest } = step as Step & { __source?: string };
    return rest as Step;
  });
}

/**
 * Write the generated dist (instructions.json + templates) into a target dir,
 * recreating it from scratch.
 */
async function writeDist(
  distDir: string,
  srcDir: string,
  instructions: Instructions,
): Promise<void> {
  if (await exists(distDir)) {
    await rm(distDir, { recursive: true, force: true });
  }
  await mkdir(path.join(distDir, "templates"), { recursive: true });

  const serializable = {
    ...instructions,
    steps: stripSource(instructions.steps),
  };

  await writeFile(
    path.join(distDir, "instructions.json"),
    `${JSON.stringify(serializable, null, 2)}\n`,
  );

  // Templates are imported as-is by the ts template runner — copy verbatim.
  await cp(
    path.join(srcDir, "templates"),
    path.join(distDir, "templates"),
    { recursive: true },
  );
}

async function buildOne(name: string, srcRelative: string): Promise<void> {
  const srcDir = path.join(PKG_DIR, srcRelative);

  // 1. Extract instructions from the source index.ts (bun imports TS natively).
  const mod = (await import(path.join(srcDir, "index.ts"))) as {
    default: DefinedInstructions;
  };
  const { instructions } = mod.default;

  // 2. Write dist into the source tree — dev mode (running from src) and the
  //    test suite resolve the built-in from here. (dist/ is gitignored.)
  await writeDist(path.join(srcDir, "dist"), srcDir, instructions);

  // 3. Write dist + package.json into lib/ — this is what ships with the
  //    published CLI and what the bundled bin.js resolves at runtime.
  const outDir = path.join(PKG_DIR, "lib/private/builtin", name);
  if (await exists(outDir)) {
    await rm(outDir, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });
  await writeDist(path.join(outDir, "dist"), srcDir, instructions);
  await cp(
    path.join(srcDir, "package.json"),
    path.join(outDir, "package.json"),
  );

  console.log(`✓ built-in powerup: ${name} → ${path.relative(PKG_DIR, outDir)}`);
}

for (const [name, src] of BUILTINS) {
  await buildOne(name, src);
}