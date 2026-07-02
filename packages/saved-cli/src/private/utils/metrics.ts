import fs from "@rcompat/fs";
import runtime from "@rcompat/runtime";
import { MAIN_FOLDER, METRICS_FILE } from "#constants";

export interface MetricsEntry {
  timestamp: string;
  pattern: string;
  characters: number;
}

/**
 * Append a metrics entry to `.saved/metrics.jsonl`.
 * Creates the file if it doesn't exist. Best-effort — callers should
 * wrap in try/catch if logging failures must not crash the run.
 */
export async function logRun(
  { pattern, characters }: Omit<MetricsEntry, "timestamp">,
): Promise<void> {
  const root = await runtime.projectRoot();
  const metricsPath = root.append(`/${MAIN_FOLDER}/${METRICS_FILE}`);

  const entry: MetricsEntry = {
    timestamp: new Date().toISOString(),
    pattern,
    characters,
  };
  const line = JSON.stringify(entry);

  // @rcompat/fs FileRef.write() overwrites, so we read-modify-write to
  // append. Metrics files are small (one line per run) so this is fine.
  let existing = "";
  if (await fs.exists(metricsPath)) {
    existing = await metricsPath.text();
  }

  await metricsPath.write(existing + line + "\n");
}

/**
 * Read all metrics entries from `.saved/metrics.jsonl`.
 * Returns an empty array if the file doesn't exist.
 * Skips blank lines and lines that fail JSON.parse.
 */
export async function readMetrics(): Promise<MetricsEntry[]> {
  const root = await runtime.projectRoot();
  const metricsPath = root.append(`/${MAIN_FOLDER}/${METRICS_FILE}`);

  if (!(await fs.exists(metricsPath))) {
    return [];
  }

  const content = await metricsPath.text();

  return content
    .split("\n")
    .filter(line => line.trim().length > 0)
    .flatMap(line => {
      try {
        return [JSON.parse(line) as MetricsEntry];
      } catch {
        return [];
      }
    });
}