import { createHash } from "node:crypto";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";

export type PreviewManifest = Record<string, string>;

export async function readPreviewManifest({
  previewDir,
}: {
  previewDir: FileRef;
}): Promise<PreviewManifest> {
  const manifestRef = previewDir.append("/.preview-manifest.json");

  if (!(await manifestRef.exists())) {
    return {};
  }

  try {
    return JSON.parse(await manifestRef.text()) as PreviewManifest;
  } catch {
    // A corrupt manifest is treated as "no history" — existing files become
    // untracked and are never deleted (safe default).
    return {};
  }
}

export async function writePreviewManifest({
  previewDir,
  manifest,
}: {
  previewDir: FileRef;
  manifest: PreviewManifest;
}): Promise<void> {
  await previewDir.append("/.preview-manifest.json").write(JSON.stringify(manifest, null, 2));
}

export async function hashFile({ path }: { path: FileRef }): Promise<string> {
  return createHash("sha256").update(await path.text()).digest("hex");
}
