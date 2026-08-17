import zod from "zod";

const powerupTypeSchema = zod.enum(["multi-use", "single-use"]);

const stepTypeSchema = zod.enum(["create", "modify", "delete", "read", "install"]);

const stepStatusSchema = zod.enum([
  "applied",
  "skipped-warning",
  "skipped-already-applied",
]);

const fileActionSchema = zod.enum(["create", "modify"]);

const createOutputSchema = zod.object({
  type: zod.literal("create"),
  path: zod.string(),
  action: fileActionSchema,
  characterCount: zod.number().int().nonnegative(),
}).strict();

const modifyOutputSchema = zod.object({
  type: zod.literal("modify"),
  path: zod.string(),
  action: fileActionSchema,
  characterCount: zod.number().int().nonnegative(),
}).strict();

const deleteOutputSchema = zod.object({
  type: zod.literal("delete"),
  path: zod.string(),
}).strict();

const installOutputSchema = zod.object({
  type: zod.literal("install"),
  dependencies: zod.array(zod.string()).optional(),
  devDependencies: zod.array(zod.string()).optional(),
  peerDependencies: zod.array(zod.string()).optional(),
}).strict();

const readOutputSchema = zod.object({
  type: zod.literal("read"),
  variable: zod.string(),
}).strict();

const noneOutputSchema = zod.object({
  type: zod.literal("none"),
}).strict();

export const stepOutputSchema = zod.discriminatedUnion("type", [
  createOutputSchema,
  modifyOutputSchema,
  deleteOutputSchema,
  installOutputSchema,
  readOutputSchema,
  noneOutputSchema,
]);

export const manifestLineSchema = zod.object({
  powerupName: zod.string(),
  version: zod.string(),
  location: zod.string(),
  type: powerupTypeSchema,
  timestamp: zod.string(),
  stepName: zod.string(),
  stepType: stepTypeSchema,
  status: stepStatusSchema,
  output: stepOutputSchema,
  from: zod.string().optional(),
}).strict();

/** A full manifest file: an array of per-step lines (JSONL, one per line). */
export const manifestSchema = zod.array(manifestLineSchema);

export type StepOutput = zod.infer<typeof stepOutputSchema>;
export type ManifestEntry = zod.infer<typeof manifestLineSchema>;
export type ManifestFile = zod.infer<typeof manifestSchema>;