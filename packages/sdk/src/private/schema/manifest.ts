import zod from "zod";

const powerupTypeSchema = zod.enum(["multi-use", "single-use"]);

const stepStatusSchema = zod.enum([
  "applied",
  "skipped-warning",
  "skipped-already-applied",
]);

const fileActionSchema = zod.enum(["create", "modify"]);

export const createOutputSchema = zod.object({
  type: zod.literal("create"),
  path: zod.string(),
  action: fileActionSchema,
  characterCount: zod.number().int().nonnegative(),
}).strict();

export const modifyOutputSchema = zod.object({
  type: zod.literal("modify"),
  path: zod.string(),
  action: fileActionSchema,
  characterCount: zod.number().int().nonnegative(),
}).strict();

export const deleteOutputSchema = zod.object({
  type: zod.literal("delete"),
  path: zod.string(),
}).strict();

export const installOutputSchema = zod.object({
  type: zod.literal("install"),
  dependencies: zod.array(zod.string()).optional(),
  devDependencies: zod.array(zod.string()).optional(),
  peerDependencies: zod.array(zod.string()).optional(),
  packageManager: zod.string(),
}).strict();

export const readOutputSchema = zod.object({
  type: zod.literal("read"),
  variable: zod.string(),
}).strict();

export const noneOutputSchema = zod.object({
  type: zod.literal("none"),
}).strict();

export type CreateOutput = zod.infer<typeof createOutputSchema>;
export type ModifyOutput = zod.infer<typeof modifyOutputSchema>;
export type DeleteOutput = zod.infer<typeof deleteOutputSchema>;
export type InstallOutput = zod.infer<typeof installOutputSchema>;
export type ReadOutput = zod.infer<typeof readOutputSchema>;
export type NoneOutput = zod.infer<typeof noneOutputSchema>;

export const stepOutputSchema = zod.discriminatedUnion("type", [
  createOutputSchema,
  modifyOutputSchema,
  deleteOutputSchema,
  installOutputSchema,
  readOutputSchema,
  noneOutputSchema,
]);

export type StepOutput = CreateOutput | ModifyOutput | DeleteOutput | InstallOutput | ReadOutput | NoneOutput;

const manifestLineBase = {
  powerupName: zod.string(),
  version: zod.string(),
  location: zod.string(),
  type: powerupTypeSchema,
  timestamp: zod.date(),
  stepName: zod.string(),
  status: stepStatusSchema,
  from: zod.string().optional(),
} as const;

export const createManifestEntrySchema = zod.object({
  ...manifestLineBase,
  stepType: zod.literal("create"),
  output: zod.union([createOutputSchema, noneOutputSchema]),
}).strict();

export const modifyManifestEntrySchema = zod.object({
  ...manifestLineBase,
  stepType: zod.literal("modify"),
  output: zod.union([modifyOutputSchema, noneOutputSchema]),
}).strict();

export const deleteManifestEntrySchema = zod.object({
  ...manifestLineBase,
  stepType: zod.literal("delete"),
  output: zod.union([deleteOutputSchema, noneOutputSchema]),
}).strict();

export const installManifestEntrySchema = zod.object({
  ...manifestLineBase,
  stepType: zod.literal("install"),
  output: zod.union([installOutputSchema, noneOutputSchema]),
}).strict();

export const readManifestEntrySchema = zod.object({
  ...manifestLineBase,
  stepType: zod.literal("read"),
  output: zod.union([readOutputSchema, noneOutputSchema]),
}).strict();

export type CreateManifestEntry = zod.infer<typeof createManifestEntrySchema>;
export type ModifyManifestEntry = zod.infer<typeof modifyManifestEntrySchema>;
export type DeleteManifestEntry = zod.infer<typeof deleteManifestEntrySchema>;
export type InstallManifestEntry = zod.infer<typeof installManifestEntrySchema>;
export type ReadManifestEntry = zod.infer<typeof readManifestEntrySchema>;

export const manifestLineSchema = zod.discriminatedUnion("stepType", [
  createManifestEntrySchema,
  modifyManifestEntrySchema,
  deleteManifestEntrySchema,
  installManifestEntrySchema,
  readManifestEntrySchema,
]);

export type ManifestEntry =
  | CreateManifestEntry
  | ModifyManifestEntry
  | DeleteManifestEntry
  | InstallManifestEntry
  | ReadManifestEntry;

export const manifestSchema = zod.array(manifestLineSchema);

export type ManifestFile = zod.infer<typeof manifestSchema>;