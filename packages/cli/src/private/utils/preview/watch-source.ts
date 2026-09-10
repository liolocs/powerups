import { stat } from "node:fs/promises";
import type { FileRef } from "@rcompat/fs";
import walkFiles from "#utils/create/capture-files/walk-files";

export type SourceSnapshot = Map<string, number>;

const WATCHED_DIR_NAMES = ["src", "fixtures"];
const WATCHED_ROOT_FILES = ["index.ts", "preview.json"];

export async function takeSourceSnapshot({ powerupRoot }: { powerupRoot: FileRef }): Promise<SourceSnapshot> {
  const snapshot: SourceSnapshot = new Map();

  for (const watchedDirName of WATCHED_DIR_NAMES) {
    const watchedDir = powerupRoot.append(`/${watchedDirName}`);

    if (!(await watchedDir.exists())) {
      continue;
    }

    for (const file of await walkFiles({ root: watchedDir })) {
      const stats = await stat(watchedDir.append(`/${file}`).path);
      snapshot.set(`${watchedDirName}/${file}`, stats.mtimeMs);
    }
  }

  for (const rootFileName of WATCHED_ROOT_FILES) {
    const rootFileRef = powerupRoot.append(`/${rootFileName}`);

    if (await rootFileRef.exists()) {
      const stats = await stat(rootFileRef.path);
      snapshot.set(rootFileName, stats.mtimeMs);
    }
  }

  return snapshot;
}

export function snapshotsDiffer({
  previous,
  current,
}: {
  previous: SourceSnapshot;
  current: SourceSnapshot;
}): boolean {
  if (previous.size !== current.size) {
    return true;
  }

  for (const [path, mtimeMs] of current) {
    if (previous.get(path) !== mtimeMs) {
      return true;
    }
  }

  return false;
}

export function watchSources({
  powerupRoot,
  onChange,
  intervalMs = 300,
  debounceMs = 400,
}: {
  powerupRoot: FileRef;
  onChange: () => void | Promise<void>;
  intervalMs?: number;
  debounceMs?: number;
}): { stop: () => void } {
  let stopped = false;
  let lastSnapshot: SourceSnapshot | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const poll = async (): Promise<void> => {
    if (stopped) {
      return;
    }

    try {
      const current = await takeSourceSnapshot({ powerupRoot });

      if (lastSnapshot !== undefined && snapshotsDiffer({ previous: lastSnapshot, current })) {
        if (debounceTimer !== undefined) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          debounceTimer = undefined;
          onChange();
        }, debounceMs);
      }

      lastSnapshot = current;
    } finally {
      if (!stopped) {
        setTimeout(poll, intervalMs);
      }
    }
  };

  poll();

  return {
    stop: () => {
      stopped = true;

      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
    },
  };
}
