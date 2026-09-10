import { readdir } from "node:fs/promises";
import path from "node:path";
import type { FileRef } from "@rcompat/fs";

export default async function walkFiles({
  root,
  excludedDirNames = [],
  excludedBasenames = [],
  excludeEnvFiles = false,
}: {
  root: FileRef;
  excludedDirNames?: string[];
  excludedBasenames?: string[];
  excludeEnvFiles?: boolean;
}): Promise<string[]> {
  const filePaths: string[] = [];

  await collect({
    absoluteDir: root.path,
    relativeDir: "",
    excludedDirNames,
    excludedBasenames,
    excludeEnvFiles,
    filePaths,
  });

  return filePaths.sort();
}

async function collect({
  absoluteDir,
  relativeDir,
  excludedDirNames,
  excludedBasenames,
  excludeEnvFiles,
  filePaths,
}: {
  absoluteDir: string;
  relativeDir: string;
  excludedDirNames: string[];
  excludedBasenames: string[];
  excludeEnvFiles: boolean;
  filePaths: string[];
}): Promise<void> {
  const entries = await readdir(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const relativePath = relativeDir === "" ? entry.name : `${relativeDir}/${entry.name}`;

    if (entry.isDirectory()) {
      if (excludedDirNames.includes(entry.name)) {
        continue;
      }

      await collect({
        absoluteDir: path.join(absoluteDir, entry.name),
        relativeDir: relativePath,
        excludedDirNames,
        excludedBasenames,
        excludeEnvFiles,
        filePaths,
      });

      continue;
    }

    if (entry.isFile()) {
      if (excludedBasenames.includes(entry.name)) {
        continue;
      }

      if (excludeEnvFiles && entry.name.startsWith(".env")) {
        continue;
      }

      filePaths.push(relativePath);
    }
  }
}