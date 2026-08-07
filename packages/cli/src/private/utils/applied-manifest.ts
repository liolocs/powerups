import fs, { type FileRef } from "@rcompat/fs";
import { POWERUP_MANIFEST_FILE_NAME, CLI_FOLDER_NAME } from "#constants";
import {
  appliedManifestSchema,
  type AppliedEntry,
  type AppliedFile,
  type AppliedManifest,
} from "#schemas/applied";
import applied_errors from "#errors/appliedErrors";

export interface RecordApplicationArgs {
  root: FileRef;
  /** Pack name (identity), e.g. "@powerups/primate-init". */
  powerup: string;
  /** Powerup name as passed on the CLI. */
  name: string;
  version: string;
  location: "local" | "global";
  variables: Record<string, string>;
  changedFiles: AppliedFile[];
  /** When true, replace any existing entry for this powerup regardless of variables. */
  singleUse?: boolean;
}

function manifestRef(root: FileRef): FileRef {
  return root.append(`/${CLI_FOLDER_NAME}/${POWERUP_MANIFEST_FILE_NAME}`);
}

const emptyManifest = (): AppliedManifest => ({ version: 1, applied: [] });

/** Canonical serialization so variable key order does not affect matching. */
function canonicalVariables(variables: Record<string, string>): string {
  const sorted = Object.keys(variables).sort()
    .map(key => [key, variables[key]]);
  return JSON.stringify(sorted);
}

/**
 * Read the applied manifest. Missing file → empty manifest.
 * Invalid JSON or schema mismatch → throws corrupt_manifest.
 */
export async function readAppliedManifest(root: FileRef): Promise<AppliedManifest> {
  const ref = manifestRef(root);
  if (!(await fs.exists(ref))) {
    return emptyManifest();
  }
  try {
    return appliedManifestSchema.parse(await ref.json());
  } catch {
    throw applied_errors.corrupt_manifest();
  }
}

/** Write the applied manifest, creating the main folder if needed. */
export async function writeAppliedManifest(
  root: FileRef,
  manifest: AppliedManifest,
): Promise<void> {
  const ref = manifestRef(root);
  await fs.create(ref.directory);
  await ref.writeJSON(manifest);
}

/**
 * Record a powerup application in the manifest and persist it.
 *
 * Upsert rules:
 * - A same-named entry with identical variables (order-insensitive) is replaced.
 * - A same-named entry with different variables is appended (multi-use), unless
 *   `singleUse: true`, in which case the first same-named entry is replaced.
 *
 * Delete bookkeeping: any file this application deleted is removed from every
 * other entry's file list (the file no longer exists to attribute).
 *
 * Returns the updated manifest.
 */
export async function recordApplication(
  args: RecordApplicationArgs,
): Promise<AppliedManifest> {
  const manifest = await readAppliedManifest(args.root);
  const { root, singleUse, ...rest } = args;

  const deletedPaths = args.changedFiles
    .filter(file => file.action === "delete")
    .map(file => file.path);

  // Remove deleted files from every other entry
  const others = manifest.applied.map(entry => ({
    ...entry,
    files: entry.files.filter(file => !deletedPaths.includes(file.path)),
  }));

  const entry: AppliedEntry = {
    powerup: rest.powerup,
    name: rest.name,
    version: rest.version,
    location: rest.location,
    appliedAt: new Date().toISOString(),
    variables: rest.variables,
    files: rest.changedFiles,
  };

  const samePowerup = (candidate: AppliedEntry) =>
    candidate.powerup === entry.powerup && candidate.name === entry.name;

  const replaceIndex = others.findIndex(candidate =>
    samePowerup(candidate) && (singleUse === true ||
      canonicalVariables(candidate.variables) === canonicalVariables(entry.variables)));

  const applied = replaceIndex === -1
    ? [...others, entry]
    : others.map((candidate, index) => index === replaceIndex ? entry : candidate);

  const updated: AppliedManifest = { version: 1, applied };
  await writeAppliedManifest(root, updated);
  return updated;
}