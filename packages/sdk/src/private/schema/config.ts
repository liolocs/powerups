import zod from "zod";

const packageEntrySchema = zod.union([
  zod.string(),
  zod.object({
    package: zod.string(),
    powerups: zod.object({
      include: zod.array(zod.string()).optional(),
      exclude: zod.array(zod.string()).optional(),
    }).optional(),
  }),
]);

export const powerupConfigSchema = zod.object({
  packages: zod.array(packageEntrySchema).default([]),
});

export type PackageEntry = zod.infer<typeof packageEntrySchema>;
export type PowerupConfig = zod.infer<typeof powerupConfigSchema>;