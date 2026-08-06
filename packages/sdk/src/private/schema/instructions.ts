import zod from "zod";

const createStepSchema = zod.object({
  type: zod.literal("create"),
  name: zod.string(),
  template: zod.string(),
  outputPath: zod.string(),
});

const modifyStepSchema = zod.object({
  type: zod.literal("modify"),
  name: zod.string(),
  template: zod.string(),
  outputPath: zod.string(),
});

const deleteStepSchema = zod.object({
  type: zod.literal("delete"),
  name: zod.string(),
  outputPath: zod.string(),
});

const readStepSchema = zod.object({
  type: zod.literal("read"),
  name: zod.string(),
  path: zod.string(),
  as: zod.string(),
  jsonPath: zod.string().optional(),
  template: zod.string().optional(),
});

// Step override value schemas (step minus `name`) — manually defined
// to avoid Omit-type cross-module export issues
const createStepOverrideSchema = zod.object({
  type: zod.literal("create"),
  template: zod.string(),
  outputPath: zod.string(),
});
const modifyStepOverrideSchema = zod.object({
  type: zod.literal("modify"),
  template: zod.string(),
  outputPath: zod.string(),
});
const deleteStepOverrideSchema = zod.object({
  type: zod.literal("delete"),
  outputPath: zod.string(),
});
const readStepOverrideSchema = zod.object({
  type: zod.literal("read"),
  path: zod.string(),
  as: zod.string(),
  jsonPath: zod.string().optional(),
  template: zod.string().optional(),
});

const stepOverrideValueSchema = zod.discriminatedUnion("type", [
  createStepOverrideSchema,
  modifyStepOverrideSchema,
  deleteStepOverrideSchema,
  readStepOverrideSchema,
]);

const includeStepSchema = zod.object({
  type: zod.literal("include"),
  name: zod.string(),
  variables: zod.record(zod.string(), zod.string()),
  stepOverride: zod.record(zod.string(), stepOverrideValueSchema).optional(),
  excludeSteps: zod.array(zod.string()).optional(),
});

export const stepSchema = zod.discriminatedUnion("type", [
  createStepSchema,
  modifyStepSchema,
  deleteStepSchema,
  readStepSchema,
  includeStepSchema,
]);

export const stepsSchema = zod.array(stepSchema);

const packageDependencyGroupSchema = zod.object({
  target: zod.string().optional(),
  dependencies: zod.array(zod.string()).optional(),
  devDependencies: zod.array(zod.string()).optional(),
  peerDependencies: zod.array(zod.string()).optional(),
});

export const instructionsSchema = zod.object({
  name: zod.string(),
  type: zod.union([zod.literal("multi-use"), zod.literal("single-use")]),
  description: zod.string(),
  variables: zod.object({
    required: zod.array(zod.string()),
    optional: zod.array(zod.string()).optional(),
  }),
  intent: zod.array(zod.string()),
  packageDependencies: zod.array(packageDependencyGroupSchema).optional(),
  steps: stepsSchema,
});

export const packageDependencyGroupArraySchema = zod.array(packageDependencyGroupSchema);

export type Step = zod.infer<typeof stepSchema>;
export type StepOverrideValue = zod.infer<typeof stepOverrideValueSchema>;
export type Instructions = zod.infer<typeof instructionsSchema>;