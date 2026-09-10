import fs from "@rcompat/fs";
import io from "@rcompat/io";
import type { FileRef } from "@rcompat/fs";
import type { Step } from "@liolocs/powerups-sdk";
import walkFiles from "#utils/create/capture-files/walk-files";
import generateStepName from "#utils/create/capture-files/generate-step-name";

const CAPTURE_EXCLUDED_DIR_NAMES = ["node_modules", "dist", ".git"];
const CAPTURE_EXCLUDED_BASENAMES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
];

export default async function captureAllFiles({
  projectRoot,
  newPowerupDirectory,
  isDryRun,
}: {
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<{ steps: Step[]; fileCount: number; warnings: string[] }> {
  const allFiles = await listProjectFiles({ projectRoot });

  const newPowerupRelativePath = newPowerupDirectory.path.replace(projectRoot.path + "/", "");
  const filteredFiles = allFiles.filter(filePath =>
    !filePath.startsWith(newPowerupRelativePath + "/"),
  );

  const steps: Step[] = [];
  const existingNames = new Set<string>();
  const warnings: string[] = [];

  for (const filePath of filteredFiles) {
    const sourceRef = projectRoot.append(`/${filePath}`);
    const fileField = `src/create/${filePath}`;

    if (!isDryRun) {
      const targetRef = newPowerupDirectory.append(`/${fileField}`);
      await fs.create(targetRef.directory);
      await sourceRef.copy(targetRef);
    }

    const stepName = generateStepName({
      prefix: "create",
      filePath,
      existingNames,
    });

    steps.push({ type: "create", name: stepName, file: fileField, outputPath: filePath });
  }

  return { steps, fileCount: filteredFiles.length, warnings };
}

async function listProjectFiles({ projectRoot }: { projectRoot: FileRef }): Promise<string[]> {
  try {
    const output = await io.run(
      "git ls-files --cached --others --exclude-standard",
      { cwd: projectRoot.path },
    );
    return filterExcluded(output.split("\n").filter(f => f.length > 0));
  } catch {
    return walkFiles({
      root: projectRoot,
      excludedDirNames: CAPTURE_EXCLUDED_DIR_NAMES,
      excludedBasenames: CAPTURE_EXCLUDED_BASENAMES,
      excludeEnvFiles: true,
    });
  }
}

function filterExcluded(filePaths: string[]): string[] {
  return filePaths.filter(filePath => {
    for (const dirName of CAPTURE_EXCLUDED_DIR_NAMES) {
      if (filePath === dirName || filePath.startsWith(dirName + "/")) return false;
      if (filePath.includes("/" + dirName + "/")) return false;
    }
    const basename = filePath.split("/").pop()!;
    if (CAPTURE_EXCLUDED_BASENAMES.includes(basename)) return false;
    if (basename.startsWith(".env")) return false;
    return true;
  });
}