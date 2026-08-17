import zod from "zod";

export const powerupConfigSchema = zod.object({
  packages: zod.array(zod.string()),
});

export type PowerupConfig = zod.infer<typeof powerupConfigSchema>;