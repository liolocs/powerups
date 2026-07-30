import p from "pema";

export const appliedFileActionSchema = p.union(
  p.literal("create"),
  p.literal("modify"),
  p.literal("delete"),
);

export const appliedFileSchema = p({
  path: p.string,
  action: appliedFileActionSchema,
});

export const appliedEntrySchema = p({
  /** Pack name (identity), e.g. "@powerups/primate-init". */
  powerup: p.string,
  /** Powerup name as passed to `pup use`, e.g. "primate-init". */
  name: p.string,
  /** Pack version at apply time. */
  version: p.string,
  /** Whether the pack was resolved locally (project store) or globally. */
  location: p.union(p.literal("local"), p.literal("global")),
  appliedAt: p.string,
  variables: p.record(p.string, p.string),
  files: p.array(appliedFileSchema),
});

export const appliedManifestSchema = p({
  version: p.number,
  applied: p.array(appliedEntrySchema),
});

export type AppliedFileAction = (typeof appliedFileActionSchema)["infer"];
export type AppliedFile = (typeof appliedFileSchema)["infer"];
export type AppliedEntry = (typeof appliedEntrySchema)["infer"];
export type AppliedManifest = (typeof appliedManifestSchema)["infer"];