import p from "pema";
import { MULTI_USE_FOLDER, SINGLE_USE_FOLDER } from "#constants";

/**
 * Schema for the "powers" property inside a package.json.
 * Maps power names to arrays of instruction.json paths.
 * Top-level powers use their name as the key.
 * Inherited sub-powers use "parent:child" notation.
 */
export const powersPropertySchema = p({
  active: p({
    [MULTI_USE_FOLDER]: p.record(p.string, p.array(p.string)).optional(),
    [SINGLE_USE_FOLDER]: p.record(p.string, p.array(p.string)).optional(),
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
  powers: powersPropertySchema,
});

export type PackageJson = (typeof packageJsonSchema)["infer"];
export type PowersProperty = (typeof powersPropertySchema)["infer"];