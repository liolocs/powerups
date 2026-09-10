import zod from "zod";

export const previewSchema = zod.object({
  variables: zod.record(zod.string(), zod.string()).optional(),
  run: zod.string().optional(),
  output: zod.string().optional(),
  watch: zod.boolean().optional(),
}).strict();

export type PreviewJsonFile = zod.infer<typeof previewSchema>;

export const previewJsonSchema = () =>
  zod.toJSONSchema(previewSchema, { io: "input" });