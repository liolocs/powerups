import io from "@rcompat/io";
import fs from "@rcompat/fs";
import type { FileRef } from "@rcompat/fs";
import type { Step } from "@liolocs/powerups-sdk";
import wrapAsTemplate from "#utils/create/capture-files/wrap-as-template";
import generateStepName from "#utils/create/capture-files/generate-step-name";

const EXCLUDED_BASENAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);

const EXCLUDED_DIR_PREFIXES = ["node_modules/", "dist/", ".git/"];

export default async function captureAllFiles({
  projectRoot,
  newPowerupDirectory,
  isDryRun,
}: {
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  isDryRun: boolean;
}): Promise<{ steps: Step[]; fileCount: number; warnings: string[] }> {
  const output = await io.run(
    "git ls-files --cached --others --exclude-standard",
    { cwd: projectRoot.path },
  );

  const allFiles = output.split("\n").filter(f => f.length > 0);

  const newPowerupRelativePath = newPowerupDirectory.path.replace(projectRoot.path + "/", "");

  const filteredFiles = allFiles.filter(filePath => {
    if (filePath.startsWith(newPowerupRelativePath + "/")) return false;

    for (const prefix of EXCLUDED_DIR_PREFIXES) {
      if (filePath.includes("/" + prefix) || filePath.startsWith(prefix)) return false;
    }

    const basename = filePath.split("/").pop()!;
    if (EXCLUDED_BASENAMES.has(basename)) return false;
    if (basename.startsWith(".env")) return false;

    return true;
  });

  const steps: Step[] = [];
  const existingNames = new Set<string>();
  const warnings: string[] = [];

  for (const filePath of filteredFiles) {
    const sourcePath = projectRoot.append(`/${filePath}`);
    const content = await sourcePath.text();

    const templateContent = wrapAsTemplate(content);
    const templatePath = `templates/${filePath}.ts`;

    if (!isDryRun) {
      const templateFileRef = newPowerupDirectory.append(`/${templatePath}`);
      await fs.create(templateFileRef.directory);
      await templateFileRef.write(templateContent);
    }

    const stepName = generateStepName({
      prefix: "create",
      filePath,
      existingNames,
    });

    steps.push({
      type: "create",
      name: stepName,
      template: templatePath,
      outputPath: filePath,
    });
  }

  return { steps, fileCount: filteredFiles.length, warnings };
}