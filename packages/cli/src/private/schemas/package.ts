import p from "pema";
import { MULTI_USE_FOLDER, SINGLE_USE_FOLDER } from "#constants";

/**
 * Schema for the "powers" property inside a package.json.
 * Maps powerup names to an instruction.json path.
 * Top-level powers use their name as the key.
 * Inherited sub-powers use "parent:child" notation.
 */
export const powerupPropertySchema = p({
  active: p({
    [MULTI_USE_FOLDER]: p.record(p.string, p.string).optional(),
    [SINGLE_USE_FOLDER]: p.record(p.string, p.string).optional(),
  }),
});

/**
 * Schema for a package's package.json file.
 */
export const packageJsonSchema = p({
  name: p.string,
  version: p.string,
  description: p.string,
  keywords: p.array(p.string),
  powerups: powerupPropertySchema,
});

export type PackageJson = (typeof packageJsonSchema)["infer"];
export type PowerUpProperty = (typeof powerupPropertySchema)["infer"];