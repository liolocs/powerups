import io from "@rcompat/io";
import { type FileRef } from "@rcompat/fs";
import path from "node:path";
import create_errors from "#errors/createErrors";

export type GitChangeStatus = "new" | "modified" | "deleted" | "renamed" | "unknown";

export type GitChange = {
  path: string;
  status: GitChangeStatus;
  rawStatus: string;
};

const EXCLUDED_PATHS = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);

function classifyStatus(rawStatus: string): GitChangeStatus {
  const x = rawStatus[0];
  const y = rawStatus[1];

  if (rawStatus === "??") return "new";
  if (x === "A" && y === "D") return "unknown";
  if (x === "A") return "new";
  if (x === "R" || x === "C") return "renamed";
  if (x === "D" || y === "D") return "deleted";
  if (x === "M" || y === "M") return "modified";

  return "unknown";
}

function shouldExclude(filePath: string): boolean {
  if (filePath.startsWith(".powerups/")) return true;
  const basename = path.basename(filePath);
  return EXCLUDED_PATHS.has(basename);
}

function unquotePath(rawPath: string): string {
  if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
    return rawPath.slice(1, -1);
  }
  return rawPath;
}

function extractPath(rawStatus: string, rest: string): string {
  if (rawStatus[0] === "R" || rawStatus[0] === "C") {
    const arrowIndex = rest.indexOf(" -> ");
    if (arrowIndex !== -1) {
      return unquotePath(rest.substring(arrowIndex + 4));
    }
  }
  return unquotePath(rest);
}

export async function getGitStatus({
  workingDir,
  projectRoot,
}: {
  workingDir: FileRef;
  projectRoot: FileRef;
}): Promise<GitChange[]> {
  let statusOutput: string;
  try {
    statusOutput = await io.run(
      `git status --porcelain --untracked-files=all -- "${workingDir.path}"`,
      { cwd: projectRoot.path },
    );
  } catch {
    throw create_errors.not_a_git_repo();
  }

  if (!statusOutput.trim()) {
    return [];
  }

  let gitRoot: string;
  try {
    gitRoot = (await io.run("git rev-parse --show-toplevel", {
      cwd: projectRoot.path,
    })).trim();
  } catch {
    throw create_errors.not_a_git_repo();
  }

  const changes: GitChange[] = [];

  for (const line of statusOutput.split("\n")) {
    if (!line.trim()) continue;

    const rawStatus = line.substring(0, 2);
    const rest = line.substring(3);
    const filePath = extractPath(rawStatus, rest);

    const absolutePath = path.join(gitRoot, filePath);
    const projectRelativePath = path.relative(projectRoot.path, absolutePath);

    if (projectRelativePath.startsWith("..")) continue;
    if (shouldExclude(projectRelativePath)) continue;

    changes.push({
      path: projectRelativePath,
      status: classifyStatus(rawStatus),
      rawStatus,
    });
  }

  return changes;
}