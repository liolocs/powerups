import zod from "zod";

export const powerupPropertySchema = zod.object({
  instructions: zod.string(),
  compatibility: zod.record(zod.string(), zod.unknown()).optional(),
});

export type PowerupProperty = zod.infer<typeof powerupPropertySchema>;