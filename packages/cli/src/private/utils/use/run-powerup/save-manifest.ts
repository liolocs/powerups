import { type ManifestEntry } from "@liolocs/powerups-sdk";
import { type FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";

export default async function saveManifest({
  destination,
  manifest,
}: {
  destination: FileRef;
  manifest: ManifestEntry;
}): Promise<void> {
  const ref = destination.append("/manifest.jsonl");

  const fileExists = await fs.exists(ref);

  if (!fileExists) {
    await ref.write(JSON.stringify([manifest]) + "\n");
  } else {
    const existing = await ref.json() as unknown as ManifestEntry[];

    existing.push(manifest);

    await ref.write(JSON.stringify(existing) + "\n");
  }
}