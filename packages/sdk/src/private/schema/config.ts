import zod from "zod";

const packageEntrySchema = zod.union([
  zod.string(),
  zod.object({
    package: zod.string(),
    name: zod.string().optional(),
  }),
]);

export const powerupConfigSchema = zod.object({
  packages: zod.array(packageEntrySchema).default([]),
});

export type PackageEntry = zod.infer<typeof packageEntrySchema>;
export type PowerupConfig = zod.infer<typeof powerupConfigSchema>;