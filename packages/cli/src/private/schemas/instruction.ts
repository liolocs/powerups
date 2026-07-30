import p from "pema";

const createStepSchema = p({
  type: p.literal("create"),
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

const modifyStepSchema = p({
  type: p.literal("modify"),
  name: p.string,
  template: p.string,
  outputPath: p.string,
});

const deleteStepSchema = p({
  type: p.literal("delete"),
  name: p.string,
  outputPath: p.string,
});

const readStepSchema = p({
  type: p.literal("read"),
  name: p.string,
  path: p.string,
  as: p.string,
  jsonPath: p.string.optional(),
  template: p.string.optional(),
});

// Step override value schemas (step minus `name`) — manually defined
// to avoid pema OmitType cross-module export issues
const createStepOverrideSchema = p({
  type: p.literal("create"),
  template: p.string,
  outputPath: p.string,
});
const modifyStepOverrideSchema = p({
  type: p.literal("modify"),
  template: p.string,
  outputPath: p.string,
});
const deleteStepOverrideSchema = p({
  type: p.literal("delete"),
  outputPath: p.string,
});
const readStepOverrideSchema = p({
  type: p.literal("read"),
  path: p.string,
  as: p.string,
  jsonPath: p.string.optional(),
  template: p.string.optional(),
});

const stepOverrideValueSchema = p.union(
  createStepOverrideSchema,
  modifyStepOverrideSchema,
  deleteStepOverrideSchema,
  readStepOverrideSchema,
);

const includeStepSchema = p({
  type: p.literal("include"),
  name: p.string,
  variables: p.record(p.string, p.string),
  stepOverride: p.record(p.string, stepOverrideValueSchema).optional(),
  excludeSteps: p.array(p.string).optional(),
});

export const stepSchema = p.union(
  createStepSchema,
  modifyStepSchema,
  deleteStepSchema,
  readStepSchema,
  includeStepSchema,
);

export const stepsSchema = p.array(stepSchema);

const packageDependencyGroupSchema = p({
  target: p.string.optional(),
  dependencies: p.array(p.string).optional(),
  devDependencies: p.array(p.string).optional(),
  peerDependencies: p.array(p.string).optional(),
});

export const instructionsSchema = p({
  name: p.string,
  type: p.union(p.literal("multi-use"), p.literal("single-use")),
  description: p.string,
  variables: p({
    required: p.array(p.string),
    optional: p.array(p.string).optional(),
  }),
  intent: p.array(p.string),
  packageDependencies: p.array(packageDependencyGroupSchema).optional(),
  steps: stepsSchema,
});

export const packageDependencyGroupArraySchema = p.array(packageDependencyGroupSchema);

export type Step = (typeof stepSchema)["infer"];
export type StepOverrideValue = (typeof stepOverrideValueSchema)["infer"];
export type Instructions = (typeof instructionsSchema)["infer"];