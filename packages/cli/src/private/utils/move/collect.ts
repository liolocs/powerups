import type { FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import { CodeError } from "@rcompat/error";
import pack_errors from "#errors/packErrors";
import { PowerErrorCode } from "#errors/powerErrors";
import { instructionsSchema, type Instructions } from "#schemas/instruction";
import { resolvePowerUp, type ResolvedPowerUp } from "#utils/resolve-powerup";
import { type PackageJson } from "#schemas/package";
import { type PowerUpType, CLI_NAME } from "#constants";

export type CollectedSubPowerUp = {
  folder: FileRef;
  type: PowerUpType;
  parent: string;
};

type ResolveParams = {
  root: FileRef;
  name: string;
};

/**
 * Dependencies injected into {@link collectSubPowerUps} so it can be unit-tested
 * without touching the filesystem.
 *
 * - `readInstructions`: reads & parses an `instructions.json` from a powerup folder.
 * - `resolve`: resolves a powerup name to its folder + type.
 */
export type CollectDeps = {
  readInstructions: (folder: FileRef) => Promise<Instructions>;
  resolve: (params: ResolveParams) => Promise<ResolvedPowerUp>;
};

/**
 * Default production dependencies — read from disk and resolve via config.
 */
export const defaultCollectDeps: CollectDeps = {
  readInstructions: async (folder) =>
    instructionsSchema.parse(await folder.append("/instructions.json").json()),
  resolve: ({ root, name }) => resolvePowerUp(root, name),
};

type CheckCycleParams = {
  pathStack: string[];
  name: string;
};

/**
 * Pure cycle-detection helper.
 *
 * Throws `circular_include` if `name` already appears in `pathStack`.
 * Otherwise returns a new stack with `name` appended.
 */
export function checkCycle({ pathStack, name }: CheckCycleParams): string[] {
  if (pathStack.includes(name)) {
    throw pack_errors.circular_include([...pathStack, name].join(" → "));
  }
  return [...pathStack, name];
}

type CollectSubPowerUpsParams = {
  root: FileRef;
  powerupsName: string;
  powerupsFolder: FileRef;
  pathStack: string[];
  deps?: CollectDeps;
};

/**
 * Recursively collect all sub-powerups included by a powerup.
 *
 * Returns a map of sub-powerup names to their resolved metadata.
 * Detects circular includes via {@link checkCycle}.
 *
 * I/O is fully injected through `deps`, making this function testable
 * without real files on disk.
 */
export async function collectSubPowerUps({
  root,
  powerupsName,
  powerupsFolder,
  pathStack,
  deps = defaultCollectDeps,
}: CollectSubPowerUpsParams): Promise<Map<string, CollectedSubPowerUp>> {
  const newPathStack = checkCycle({ pathStack, name: powerupsName });
  const collected = new Map<string, CollectedSubPowerUp>();

  const instructions = await deps.readInstructions(powerupsFolder);

  for (const step of instructions.steps) {
    if (step.type !== "include") continue;
    if (collected.has(step.name)) continue;

      try {
        const resolved = await deps.resolve({ root, name: step.name });
        collected.set(step.name, {
          folder: resolved.folder,
          type: resolved.type,
          parent: powerupsName,
        });

        // Recurse and merge sub-results
        const subCollected = await collectSubPowerUps({
          root,
          powerupsName: ref.name,
          powerupsFolder: resolved.folder,
          pathStack: newPathStack,
          deps,
        });
        for (const [key, value] of subCollected) {
          if (!collected.has(key)) collected.set(key, value);
        }
      } catch (e) {
        // Only mask not_found errors as subpower_unresolvable.
        // Re-throw other errors (ambiguous, circular_include) as-is.
        if (e instanceof CodeError && (e as CodeError).code === PowerErrorCode.not_found) {
          throw pack_errors.subpower_unresolvable(ref.name, powerupsName);
        }
        throw e;
      }
    }
  }

  return collected;
}

type CollectAllSubPowerUpsParams = {
  root: FileRef;
  localPkgJson: PackageJson;
  localPackageDir: FileRef;
  deps?: CollectDeps;
};

/**
 * Iterate every top-level powerup in a package's `active` record and collect
 * all of their sub-powerups into a single merged map.
 *
 * `parent:child` entries in the active record are skipped — they are the
 * output of a previous move, not powerups to traverse.
 */
export async function collectAllSubPowerUps({
  root,
  localPkgJson,
  localPackageDir,
  deps = defaultCollectDeps,
}: CollectAllSubPowerUpsParams): Promise<Map<string, CollectedSubPowerUp>> {
  const collected = new Map<string, CollectedSubPowerUp>();
  const active = localPkgJson[CLI_NAME].active;
  const activeRecord = active as Record<string, Record<string, string>>;

  for (const [, powersMap] of Object.entries(activeRecord)) {
    if (!is.defined(powersMap)) continue;

    for (const [powerKey, instructionPath] of Object.entries(powersMap)) {
      // Skip parent:child entries (already collected in a prior move)
      if (powerKey.includes(":")) continue;

      const powerupsName = powerKey;
      const powerupsFolder = localPackageDir.append(`/${instructionPath}`).directory;

      const subs = await collectSubPowerUps({
        root,
        powerupsName,
        powerupsFolder,
        pathStack: [],
        deps,
      });
      for (const [key, value] of subs) {
        if (!collected.has(key)) collected.set(key, value);
      }
    }
  }

  return collected;
}