import zod from "zod";

const variableMapSchema = zod.record(zod.string(), zod.string()).optional();

const fromSchema = zod.object({
  name: zod.string(),
  singleUse: zod.boolean(),
}).optional();

export const createStepSchema = zod.object({
  type: zod.literal("create"),
  name: zod.string(),
  template: zod.string(),
  outputPath: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: fromSchema,
});

export const modifyStepSchema = zod.object({
  type: zod.literal("modify"),
  name: zod.string(),
  template: zod.string(),
  outputPath: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: fromSchema,
});

export const deleteStepSchema = zod.object({
  type: zod.literal("delete"),
  name: zod.string(),
  outputPath: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: fromSchema,
});

export const readStepSchema = zod.object({
  type: zod.literal("read"),
  name: zod.string(),
  path: zod.string(),
  as: zod.string(),
  jsonPath: zod.string().optional(),
  template: zod.string().optional(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: fromSchema,
});

export const installStepSchema = zod.object({
  type: zod.literal("install"),
  name: zod.string(),
  target: zod.string().optional(),
  dependencies: zod.array(zod.string()).optional(),
  devDependencies: zod.array(zod.string()).optional(),
  peerDependencies: zod.array(zod.string()).optional(),
  packageManager: zod.union([
    zod.literal("pnpm"),
    zod.literal("npm"),
    zod.literal("bun"),
    zod.literal("yarn"),
    zod.literal("auto"),
  ]).default("npm"),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: fromSchema,
});

export type CreateStep = zod.infer<typeof createStepSchema>;
export type ModifyStep = zod.infer<typeof modifyStepSchema>;
export type DeleteStep = zod.infer<typeof deleteStepSchema>;
export type ReadStep = zod.infer<typeof readStepSchema>;
export type InstallStep = zod.infer<typeof installStepSchema>;

export const stepSchema = zod.discriminatedUnion("type", [
  createStepSchema,
  modifyStepSchema,
  deleteStepSchema,
  readStepSchema,
  installStepSchema,
]);

export const stepsSchema = zod.array(stepSchema);

export const instructionsSchema = zod.object({
  name: zod.string(),
  type: zod.union([zod.literal("multi-use"), zod.literal("single-use")]),
  description: zod.string(),
  variables: zod.object({
    required: zod.array(zod.string()),
    optional: zod.array(zod.string()).optional(),
    defaults: zod.record(zod.string(), zod.string()).optional(),
  }),
  intent: zod.array(zod.string()),
  steps: stepsSchema,
}).strict();

export type StepOverrideValue =
  | { type: "create"; template: string; outputPath: string }
  | { type: "modify"; template: string; outputPath: string }
  | { type: "delete"; outputPath: string }
  | { type: "read"; path: string; as: string; jsonPath?: string; template?: string }
  | {
      type: "install";
      target?: string;
      dependencies?: string[];
      devDependencies?: string[];
      peerDependencies?: string[];
    };

export type Step = CreateStep | ModifyStep | DeleteStep | ReadStep | InstallStep;
export type Instructions = zod.infer<typeof instructionsSchema>;