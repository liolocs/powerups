import zod from "zod";

const variableMapSchema = zod.record(zod.string(), zod.string()).optional();

const fromSchema = zod.object({
  name: zod.string(),
  singleUse: zod.boolean(),
}).optional();

const stepBase = {
  name: zod.string(),
  variableMap: variableMapSchema,
  __source: zod.string().optional(),
  from: fromSchema,
} as const;

export const createStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("create"),
  file: zod.string(),
  outputPath: zod.string(),
});

export const dynamicCreateStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("dynamic-create"),
  template: zod.string(),
  outputPath: zod.string(),
});

export const modifyStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("modify"),
  file: zod.string(),
  outputPath: zod.string(),
});

export const dynamicModifyStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("dynamic-modify"),
  template: zod.string(),
  outputPath: zod.string(),
});

export const deleteStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("delete"),
  outputPath: zod.string(),
});

export const readStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("read"),
  path: zod.string(),
  as: zod.string(),
  jsonPath: zod.string().optional(),
  template: zod.string().optional(),
});

export const installStepSchema = zod.object({
  ...stepBase,
  type: zod.literal("install"),
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
});

export type CreateStep = zod.infer<typeof createStepSchema>;
export type DynamicCreateStep = zod.infer<typeof dynamicCreateStepSchema>;
export type ModifyStep = zod.infer<typeof modifyStepSchema>;
export type DynamicModifyStep = zod.infer<typeof dynamicModifyStepSchema>;
export type DeleteStep = zod.infer<typeof deleteStepSchema>;
export type ReadStep = zod.infer<typeof readStepSchema>;
export type InstallStep = zod.infer<typeof installStepSchema>;

export const stepSchema = zod.discriminatedUnion("type", [
  createStepSchema,
  dynamicCreateStepSchema,
  modifyStepSchema,
  dynamicModifyStepSchema,
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
  | { type: "create"; file: string; outputPath: string }
  | { type: "dynamic-create"; template: string; outputPath: string }
  | { type: "modify"; file: string; outputPath: string }
  | { type: "dynamic-modify"; template: string; outputPath: string }
  | { type: "delete"; outputPath: string }
  | { type: "read"; path: string; as: string; jsonPath?: string; template?: string }
  | {
      type: "install";
      target?: string;
      dependencies?: string[];
      devDependencies?: string[];
      peerDependencies?: string[];
    };

export type Step = CreateStep | DynamicCreateStep | ModifyStep | DynamicModifyStep | DeleteStep | ReadStep | InstallStep;
export type Instructions = zod.infer<typeof instructionsSchema>;