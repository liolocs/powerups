import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import fs from "@rcompat/fs";
import io from "@rcompat/io";
import wrapAsTemplate from "#utils/create/capture-files/wrap-as-template";
import generateStepName from "#utils/create/capture-files/generate-step-name";
import { generateModifications, type DiffHunk } from "#utils/create/capture-files/diff-to-modifications";
import type { GitChange } from "#utils/create/capture-files/git-status";

export default async function createStepsFromModifiedFiles({
  modifiedFiles,
  projectRoot,
  newPowerupDirectory,
  existingNames,
  warnings,
  isDryRun,
}: {
  modifiedFiles: GitChange[];
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  existingNames: Set<string>;
  warnings: string[];
  isDryRun: boolean;
}): Promise<Step[]> {
  const steps: Step[] = [];

  for (const change of modifiedFiles) {
    const step = await createModifyStep({
      change,
      projectRoot,
      newPowerupDirectory,
      existingNames,
      warnings,
      isDryRun,
    });

    if (step !== null) {
      steps.push(step);
    }
  }

  return steps;
}

async function createModifyStep({
  change,
  projectRoot,
  newPowerupDirectory,
  existingNames,
  warnings,
  isDryRun,
}: {
  change: GitChange;
  projectRoot: FileRef;
  newPowerupDirectory: FileRef;
  existingNames: Set<string>;
  warnings: string[];
  isDryRun: boolean;
}): Promise<Step | null> {
  const diffOutput = await io.run(
    `git diff HEAD -- "${change.path}"`,
    { cwd: projectRoot.path },
  );

  if (diffOutput.includes("Binary files differ")) {
    warnings.push(`${change.path}: binary file — cannot generate modifications`);

    return null;
  }

  if (diffOutput.trim().length === 0) {
    warnings.push(`${change.path}: empty diff — no changes detected`);

    return null;
  }

  let preImage: string;

  try {
    preImage = await io.run(`git show HEAD:"${change.path}"`, { cwd: projectRoot.path });
  } catch {
    warnings.push(`${change.path}: could not read pre-image from HEAD`);

    return null;
  }

  const postImagePath = projectRoot.append(`/${change.path}`);

  if (!(await fs.exists(postImagePath))) {
    warnings.push(`${change.path}: post-image file not found`);

    return null;
  }

  const postImage = await postImagePath.text();
  const hunks = parseDiffHunks(diffOutput);
  const result = generateModifications({ preImage, postImage, hunks });

  for (const warning of result.warnings) {
    warnings.push(`${change.path}: ${warning}`);
  }

  const jsonString = JSON.stringify(result.modifications, null, 2);
  const templateContent = wrapAsTemplate(jsonString);
  const templatePath = `templates/${change.path}.modify.ts.ts`;

  if (!isDryRun) {
    const templateFileRef = newPowerupDirectory.append(`/${templatePath}`);
    await fs.create(templateFileRef.directory);
    await templateFileRef.write(templateContent);
  }

  const stepName = generateStepName({ prefix: "modify", filePath: change.path, existingNames });

  return { type: "modify", name: stepName, template: templatePath, outputPath: change.path };
}

function parseDiffHunks(diffOutput: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diffOutput.split("\n");

  const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    const headerMatch = line.match(hunkHeaderRegex);

    if (headerMatch !== null) {
      if (currentHunk !== null) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        oldStart: parseInt(headerMatch[1]!, 10),
        oldCount: headerMatch[2] ? parseInt(headerMatch[2], 10) : 1,
        newStart: parseInt(headerMatch[3]!, 10),
        newCount: headerMatch[4] ? parseInt(headerMatch[4], 10) : 1,
        lines: [],
      };
      continue;
    }

    if (currentHunk === null) continue;

    if (line.startsWith("diff --git") || line.startsWith("---") || line.startsWith("+++")
      || line.startsWith("index ")) {
      continue;
    }

    if (line.startsWith("\\ ") && line.includes("No newline at end of file")) {
      if (currentHunk !== null && currentHunk.lines.length > 0) {
        currentHunk.lines[currentHunk.lines.length - 1]!.noNewline = true;
      }
      continue;
    }

    if (line.startsWith("+")) {
      currentHunk.lines.push({ type: "added", content: line.substring(1) });
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({ type: "removed", content: line.substring(1) });
    } else if (line.startsWith(" ")) {
      currentHunk.lines.push({ type: "context", content: line.substring(1) });
    }
  }

  if (currentHunk !== null) {
    hunks.push(currentHunk);
  }

  return hunks;
}