export { powerupPropertySchema, type PowerupProperty } from "#schema/powerup";
export { powerupConfigSchema, type PowerupConfig, type PackageEntry } from "#schema/config";
export {
  manifestLineSchema,
  type ManifestEntry,
  type ManifestFile,
  manifestSchema,
  type CreateManifestEntry,
  type ModifyManifestEntry,
  type DeleteManifestEntry,
  type InstallManifestEntry,
  type ReadManifestEntry,
  type StepOutput,
  type CreateOutput,
  type ModifyOutput,
  type DeleteOutput,
  type InstallOutput,
  type ReadOutput,
  type NoneOutput,
  installManifestEntrySchema,
  createManifestEntrySchema,
  modifyManifestEntrySchema,
  deleteManifestEntrySchema,
  readManifestEntrySchema,
} from "#schema/manifest";
export {
  instructionsSchema,
  type Instructions,
  type Step,
  type StepOverrideValue,
  type CreateStep,
  type ModifyStep,
  type DeleteStep,
  type ReadStep,
  type InstallStep,
} from "#schema/instructions";
export { defineInstructions, includePowerup } from "#include";