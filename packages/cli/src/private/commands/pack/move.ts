import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import runtime from "@rcompat/runtime";
import { Command } from "@powerups/program";
import pack_errors from "#errors/packErrors";
import { packageJsonSchema, type PowerUpProperty } from "#schemas/package";
import { instructionsSchema } from "#schemas/instruction";
import {
  addPackageToGlobalConfig,
  removePackageFromConfig,
} from "#utils/config";
import { resolvePowerUp } from "#utils/resolve-powerup";
import { CodeError } from "@rcompat/error";
import { PowerErrorCode } from "#errors/powerErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  TEMPLATE_FOLDER,
  PACKAGE_FILE,
  GLOBAL_INTERNAL_PATH,
  type PowerUpType,
  CLI_NAME,
} from "#constants";

type CollectedSubPowerUp = {
  folder: FileRef;
  type: PowerUpType;
  parent: string;
};

type CollectSubPowerUpsParams = {
  root: FileRef;
  powerupsName: string;
  powerupsType: PowerUpType;
  powerupsFolder: FileRef;
  pathStack: string[];
  collected: Map<string, CollectedSubPowerUp>;
};

/**
 * Recursively collect all sub-powerups included by a powerup.
 * Returns a map of sub-powerup names to their resolved folders.
 * Detects circular includes.
 */
async function collectSubPowerUps({
  root,
  powerupsName,
  powerupsType,
  powerupsFolder,
  pathStack,
  collected,
}: CollectSubPowerUpsParams): Promise<void> {
  if (pathStack.includes(powerupsName)) {
    throw pack_errors.circular_include([...pathStack, powerupsName].join(" → "));
  }

  const outputPath = powerupsFolder.append("/instructions.json");
  const instructions = instructionsSchema.parse(await outputPath.json());

  if (is.defined(instructions.includes)) {
    for (const ref of instructions.includes) {
      if (collected.has(ref.name)) continue;

      try {
        const resolved = await resolvePowerUp(root, ref.name);
        collected.set(ref.name, {
          folder: resolved.folder,
          type: resolved.type,
          parent: powerupsName,
        });

        await collectSubPowerUps({
          root,
          powerupsName: ref.name,
          powerupsType: resolved.type,
          powerupsFolder: resolved.folder,
          pathStack: [...pathStack, powerupsName],
          collected,
        });
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
}

/**
 * Copy a powerup folder (instructions.json + template/) to a destination.
 */
async function copyPowerFolder(
  sourceFolder: FileRef,
  destFolder: FileRef,
): Promise<void> {
  await fs.create(destFolder);

  // Copy instructions.json
  const instructionsPath = sourceFolder.append("/instructions.json");
  await destFolder.append("/instructions.json").write(
    await instructionsPath.text(),
  );

  // Copy template/ folder if it exists
  const templateDir = sourceFolder.append(`/${TEMPLATE_FOLDER}`);
  if (await fs.exists(templateDir)) {
    const destTemplateDir = destFolder.append(`/${TEMPLATE_FOLDER}`);
    await fs.create(destTemplateDir);

    const templateFiles = await templateDir.files();
    for (const file of templateFiles) {
      await destTemplateDir.append(`/${file.name}`).write(await file.text());
    }
  }
}

const packMove = new Command({
  name: "move",
  description: "Move a local package to the global location",
  flags: [
    {
      name: "delete",
      long: "delete",
      short: "d",
      description: "Remove the package from the project config after moving",
    },
  ],
  subcommands: [],
  action: async ({ subcommands, flags, context }) => {
    const packageName = subcommands?.[0];
    const destination = subcommands?.[1];

    if (!is.defined(packageName)) {
      throw pack_errors.invalid_package_name("");
    }

    if (destination !== "global") {
      throw pack_errors.invalid_move_destination(destination ?? "");
    }

    const root: FileRef = context?.root ?? await runtime.projectRoot();
    const localPackageDir = root.append(
      `/${MAIN_FOLDER}/${INTERNAL_FOLDER}/${packageName}`,
    );

    // Check source exists
    if (!(await fs.exists(localPackageDir))) {
      throw pack_errors.package_not_found(packageName);
    }

    // Check destination doesn't already exist
    const globalPackageDir = fs.ref(`${GLOBAL_INTERNAL_PATH}/${packageName}`);
    if (await fs.exists(globalPackageDir)) {
      throw pack_errors.global_destination_exists(packageName);
    }

    // Read the local package.json
    const localPkgJsonPath = localPackageDir.append(`/${PACKAGE_FILE}`);
    const localPkgJson = packageJsonSchema.parse(await localPkgJsonPath.json());

    const collectedSubPowerups = new Map<string, CollectedSubPowerUp>();

    const active = localPkgJson[CLI_NAME].active;
    const activeRecord = active as Record<string, Record<string, string[]>>;

    for (const [typeFolder, powersMap] of Object.entries(activeRecord)) {
      if (!is.defined(powersMap)) continue;

      for (const [powerKey, instructionPaths] of Object.entries(powersMap)) {
        // Skip parent:child entries (already collected)
        if (powerKey.includes(":")) continue;

        const powerupsName = powerKey;
        const instructionPath = instructionPaths[0];
        const powerupsFolder = localPackageDir.append(`/${instructionPath}`).directory;

        await collectSubPowerUps({
          root,
          powerupsName,
          powerupsType: typeFolder === MULTI_USE_FOLDER ? "multi-use" : "single-use",
          powerupsFolder,
          pathStack: [],
          collected: collectedSubPowerups,
        });
      }
    }

    // Create the global package directory
    await fs.create(globalPackageDir);

    // Copy src/active/ structure
    const srcActiveDir = localPackageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    const destSrcActiveDir = globalPackageDir.append(`/${SRC_FOLDER}/${ACTIVE_FOLDER}`);
    await fs.create(destSrcActiveDir);

    // Copy multi-use and single-use folders
    for (const typeFolder of [MULTI_USE_FOLDER, SINGLE_USE_FOLDER]) {
      const srcTypeDir = srcActiveDir.append(`/${typeFolder}`);
      if (await fs.exists(srcTypeDir)) {
        const destTypeDir = destSrcActiveDir.append(`/${typeFolder}`);
        await fs.create(destTypeDir);

        const powerDirs = await srcTypeDir.files();
        for (const powerDir of powerDirs) {
          const destPowerDir = destTypeDir.append(`/${powerDir.name}`);
          await copyPowerFolder(powerDir, destPowerDir);
        }
      }
    }

    // Build updated powers property with parent:child entries for sub-powers
    const updatedPowerups: PowerUpProperty = {
      active: {
        [MULTI_USE_FOLDER]: { ...(activeRecord[MULTI_USE_FOLDER] ?? {}) },
        [SINGLE_USE_FOLDER]: { ...(activeRecord[SINGLE_USE_FOLDER] ?? {}) },
      },
    };
    const updatedRecord = updatedPowerups.active as Record<string, Record<string, string[]>>;

    for (const [subName, info] of collectedSubPowerups) {
      const typeFolder = info.type === "multi-use" ? MULTI_USE_FOLDER : SINGLE_USE_FOLDER;
      const destTypeDir = destSrcActiveDir.append(`/${typeFolder}`);
      if (!(await fs.exists(destTypeDir))) {
        await fs.create(destTypeDir);
      }

      // Check if sub-powerup already exists in the package
      const destPowerDir = destTypeDir.append(`/${subName}`);
      if (!(await fs.exists(destPowerDir))) {
        await copyPowerFolder(info.folder, destPowerDir);
      }

      // Add parent:child entry to powers property
      const childKey = `${info.parent}:${subName}`;
      updatedRecord[typeFolder][childKey] = [
        `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${subName}/instructions.json`,
      ];
    }

    // Write the updated package.json to global
    const globalPkgJson = {
      ...localPkgJson,
      [CLI_NAME]: updatedPowerups,
    };
    await globalPackageDir.append(`/${PACKAGE_FILE}`).writeJSON(globalPkgJson as never);

    // Add to global config
    await addPackageToGlobalConfig(packageName);

    // Remove the local package directory
    await localPackageDir.remove();

    // Handle project config
    const shouldDelete = is.defined(flags.delete);
    if (shouldDelete) {
      await removePackageFromConfig(root, packageName);
    }

    const green = cli.fg.green;
    const dim = cli.fg.dim;

    cli.print(`${green("✓")} Moved package: ${packageName} → global\n`);
    cli.print(`  ${dim("global location:")} ${globalPackageDir.path}\n`);

    if (collectedSubPowerups.size > 0) {
      cli.print(`  ${dim(`sub-${CLI_NAME} pulled in:`)} ${collectedSubPowerups.size}\n`);
      for (const [subName, info] of collectedSubPowerups) {
        cli.print(`    ${dim("-")} ${subName} (from ${info.parent})\n`);
      }
    }

    if (shouldDelete) {
      cli.print(`  ${dim("removed from project config")}\n`);
    } else {
      cli.print(`  ${dim("kept in project config (resolves from global)")}\n`);
    }
  },
});

export default packMove;