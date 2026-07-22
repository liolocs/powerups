import { type PowerUpProperty, type PackageJson } from "#schemas/package";
import {
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  SRC_FOLDER,
  ACTIVE_FOLDER,
  CLI_NAME,
} from "#constants";
import type { CollectedSubPowerUp } from "#utils/move/collect";

type BuildUpdatedPowerupsParams = {
  activeRecord: Record<string, Record<string, string>>;
  collected: Map<string, CollectedSubPowerUp>;
};

/**
 * Build the updated `powerups` property for the global package.json.
 *
 * Clones the existing `active` record (multi-use + single-use maps) and adds
 * `parent:child` entries for every collected sub-powerup.
 *
 * **Pure** — no I/O, no side effects. Easily unit-testable.
 */
export function buildUpdatedPowerups({
  activeRecord,
  collected,
}: BuildUpdatedPowerupsParams): PowerUpProperty {
  const updatedPowerups: PowerUpProperty = {
    active: {
      [MULTI_USE_FOLDER]: { ...(activeRecord[MULTI_USE_FOLDER] ?? {}) },
      [SINGLE_USE_FOLDER]: { ...(activeRecord[SINGLE_USE_FOLDER] ?? {}) },
    },
  };
  const updatedRecord = updatedPowerups.active as Record<string, Record<string, string>>;

  for (const [subName, info] of collected) {
    const typeFolder = info.type === "multi-use"
      ? MULTI_USE_FOLDER
      : SINGLE_USE_FOLDER;
    const childKey = `${info.parent}:${subName}`;
    updatedRecord[typeFolder][childKey] =
      `./${SRC_FOLDER}/${ACTIVE_FOLDER}/${typeFolder}/${subName}/instructions.json`;
  }

  return updatedPowerups;
}

type BuildGlobalPackageJsonParams = {
  localPkgJson: PackageJson;
  updatedPowerups: PowerUpProperty;
};

/**
 * Build the global package.json by spreading the local package.json and
 * overriding the `powerups` property.
 *
 * **Pure** — no I/O, no side effects.
 */
export function buildGlobalPackageJson({
  localPkgJson,
  updatedPowerups,
}: BuildGlobalPackageJsonParams): PackageJson {
  return { ...localPkgJson, [CLI_NAME]: updatedPowerups };
}