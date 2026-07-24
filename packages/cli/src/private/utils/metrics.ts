import fs from "@rcompat/fs";
import path from "node:path";
import { encodeProjectPath, decodeProjectPath } from "#utils/project-path";
import { GLOBAL_ROOT, METRICS_FILE } from "#constants";

export interface MetricsEntry {
  timestamp: string;
  output: string;
  characters: number;
}

export interface ProjectMetricsEntry extends MetricsEntry {
  project: string;
}

interface MetricsOptions {
  cwd?: string;
  globalRoot?: string;
}

function resolveOptions(options?: MetricsOptions) {
  return {
    cwd: options?.cwd ?? process.cwd(),
    globalRoot: options?.globalRoot ?? GLOBAL_ROOT,
  };
}

function getMetricsPath(cwd: string, globalRoot: string): string {
  return path.join(globalRoot, "projects", encodeProjectPath(cwd), METRICS_FILE);
}

/**
 * Append a metrics entry to the global metrics file for the given project.
 * Creates the file and parent directories if they don't exist.
 * Best-effort — callers should wrap in try/catch if logging failures must not crash the run.
 */
export async function logRun(
  { output, characters }: Omit<MetricsEntry, "timestamp">,
  options?: MetricsOptions,
): Promise<void> {
  const { cwd, globalRoot } = resolveOptions(options);
  const metricsPath = getMetricsPath(cwd, globalRoot);

  const entry: MetricsEntry = {
    timestamp: new Date().toISOString(),
    output,
    characters,
  };
  const line = JSON.stringify(entry);

  let existing = "";
  if (await fs.exists(metricsPath)) {
    existing = await fs.text(metricsPath);
  }

  await fs.write(metricsPath, existing + line + "\n");
}

/**
 * Read all metrics entries for the current project from the global location.
 * Returns an empty array if the file doesn't exist.
 * Skips blank lines and lines that fail JSON.parse.
 */
export async function readMetrics(options?: MetricsOptions): Promise<MetricsEntry[]> {
  const { cwd, globalRoot } = resolveOptions(options);
  const metricsPath = getMetricsPath(cwd, globalRoot);

  if (!(await fs.exists(metricsPath))) {
    return [];
  }

  const content = await fs.text(metricsPath);

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

/**
 * Read all metrics entries across all projects from the global location.
 * Each entry is tagged with a `project` field (decoded path, best-effort).
 * Returns an empty array if no projects directory exists.
 */
export async function readAllMetrics(options?: { globalRoot?: string }): Promise<ProjectMetricsEntry[]> {
  const globalRoot = options?.globalRoot ?? GLOBAL_ROOT;
  const projectsDir = path.join(globalRoot, "projects");

  if (!(await fs.exists(projectsDir))) {
    return [];
  }

  const dirs = await fs.dirs(projectsDir);
  const entries: ProjectMetricsEntry[] = [];

  for (const dir of dirs) {
    if (!dir.name.startsWith("--") || !dir.name.endsWith("--")) continue;
    const metricsPath = path.join(dir.path, METRICS_FILE);
    if (!(await fs.exists(metricsPath))) continue;

    const content = await fs.text(metricsPath);
    const project = decodeProjectPath(dir.name);

    for (const line of content.split("\n")) {
      if (line.trim().length === 0) continue;
      try {
        entries.push({ ...(JSON.parse(line) as MetricsEntry), project });
      } catch {
        // skip corrupt lines
      }
    }
  }

  return entries;
}