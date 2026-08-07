import fs, { type FileRef } from "@rcompat/fs";
import cli from "@rcompat/cli";
import { CLI_FOLDER_NAME } from "#constants";

const MANIFEST_FILE = "manifest.jsonl";

export interface ManifestEntry {
  powerup: string;
  package: string;
  version: string;
  location: "local" | "global";
  type: "multi-use" | "single-use";
  timestamp: string;
  variables: Record<string, string>;
  steps: { name: string; type: string; status: "applied" | "skipped-warning" | "skipped-already-applied"; from?: string }[];
  files: { path: string; action: "create" | "modify" | "delete" }[];
}

function manifestRef(root: FileRef): FileRef {
  return root.append(`/${CLI_FOLDER_NAME}/${MANIFEST_FILE}`);
}

export async function readManifest(root: FileRef): Promise<ManifestEntry[]> {
  const ref = manifestRef(root);
  if (!(await fs.exists(ref))) {
    return [];
  }
  const text = await ref.text();
  const entries: ManifestEntry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      entries.push(JSON.parse(trimmed) as ManifestEntry);
    } catch {
      cli.print(`Warning: skipping unparseable manifest line\n`);
    }
  }
  return entries;
}

export async function appendManifestEntry(root: FileRef, entry: ManifestEntry): Promise<void> {
  const ref = manifestRef(root);
  await fs.create(ref.directory);
  const line = JSON.stringify(entry) + "\n";
  const existing = await fs.exists(ref) ? await ref.text() : "";
  await ref.write(existing + line);
}

export async function hasBeenApplied(root: FileRef, powerupName: string): Promise<boolean> {
  const entries = await readManifest(root);
  return entries.some(e => e.powerup === powerupName);
}