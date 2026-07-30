import fs, { type FileRef } from "@rcompat/fs";
import io from "@rcompat/io";
import cli from "@rcompat/cli";
import is from "@rcompat/is";
import path from "node:path";
import runtime from "@rcompat/runtime";
import create_errors from "#errors/createErrors";
import {
  MAIN_FOLDER,
  INTERNAL_FOLDER,
  MULTI_USE_FOLDER,
  SINGLE_USE_FOLDER,
  PACKAGE_FILE,
  KEYWORD_PACKAGE,
  CLI_NAME,
  powerupsFolderMap,
  type PowerUpType,
} from "#constants";
import {
  packageDependencyGroupArraySchema,
  instructionsSchema,
  type Instructions,
  type Step,
} from "#schemas/instruction";
import { packageJsonSchema } from "#schemas/package";
import { addPackageToConfig } from "#utils/config";
import { getGitStatus, type GitChange } from "#utils/git/git-status";
import {
  generateModifications,
  type DiffHunk,
  type DiffLine,
} from "#utils/git/diff-to-modifications";

type CreatePowerupOverrides = {
  pack?: string;
  type?: string;
  description?: string;
  intent?: string;
  variables?: string;
  optionalVariables?: string;
  packageDeps?: string;
};

type CreatePowerupResult = {
  packageName: string;
  packageAutoCreated: boolean;
  newFileCount: number;
  modifiedFileCount: number;
  deletedFileCount: number;
  warnings: string[];
};

function parseCommaList(value: string | undefined): string[] {
  if (!is.defined(value) || value.length === 0) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

function stripScope(packageName: string): string {
  if (packageName.startsWith("@") && packageName.includes("/")) {
    return packageName.substring(packageName.indexOf("/") + 1);
  }
  return packageName;
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

function generateStepName({
  prefix,
  filePath,
  existingNames,
}: {
  prefix: "create" | "modify" | "delete";
  filePath: string;
  existingNames: Set<string>;
}): string {
  const lastDotIndex = filePath.lastIndexOf(".");
  const lastSlashIndex = filePath.lastIndexOf("/");
  const pathNoExt = lastDotIndex > lastSlashIndex
    ? filePath.substring(0, lastDotIndex)
    : filePath;
  const baseName = `${prefix}-${pathNoExt.replace(/\//g, "-")}`;

  if (!existingNames.has(baseName)) {
    existingNames.add(baseName);
    return baseName;
  }

  let counter = 2;
  while (existingNames.has(`${baseName}-${counter}`)) {
    counter++;
  }
  const finalName = `${baseName}-${counter}`;
  existingNames.add(finalName);
  return finalName;
}

async function ensurePackageExists({
  packageName,
  internalFolder,
}: {
  packageName: string;
  internalFolder: FileRef;
}): Promise<boolean> {
  const packageDir = internalFolder.append(`/${packageName}`);

  if (await fs.exists(packageDir)) {
    return false;
  }

  await fs.create(packageDir.append(`/${MULTI_USE_FOLDER}`));
  await fs.create(packageDir.append(`/${SINGLE_USE_FOLDER}`));

  const packageJson = {
    name: packageName,
    version: "1.0.0",
    description: "",
    keywords: [KEYWORD_PACKAGE],
    [CLI_NAME]: {
      active: {
        [MULTI_USE_FOLDER]: {},
        [SINGLE_USE_FOLDER]: {},
      },
    },
  };

  await packageDir.append(`/${PACKAGE_FILE}`).writeJSON(packageJson as never);
  return true;
}

function buildInstructions({
  name,
  description,
  required,
  optional,
  intent,
  packageDependencies,
  steps,
}: {
  name: string;
  description: string;
  required: string[];
  optional: string[];
  intent: string[];
  packageDependencies: Instructions["packageDependencies"];
  steps: Step[];
}): Instructions {
  return {
    name,
    description,
    variables: {
      required,
      optional: optional.length > 0 ? optional : undefined,
    },
    intent,
    packageDependencies,
    steps,
  };
}

async function registerPowerup({
  packageDir,
  typeFolderName,
  name,
}: {
  packageDir: FileRef;
  typeFolderName: string;
  name: string;
}): Promise<void> {
  const packageJsonPath = packageDir.append(`/${PACKAGE_FILE}`);
  const pkgJson = packageJsonSchema.parse(await packageJsonPath.json());
  const pkgJsonPowerups = pkgJson[CLI_NAME];

  let powerupsMap: Record<string, string> = {};

  if (is.truthy(
    pkgJsonPowerups.active[
    typeFolderName as keyof typeof pkgJsonPowerups.active
    ],
  )) {
    powerupsMap = pkgJsonPowerups.active[
    typeFolderName as keyof typeof pkgJsonPowerups.active
    ] as Record<string, string>;
  }

  powerupsMap[name] = `./${typeFolderName}/${name}/instructions.json`;

  (pkgJson[CLI_NAME].active as Record<string, Record<string, string>>)[typeFolderName] = powerupsMap;

  await packageJsonPath.writeJSON(pkgJson as never);
}

async function processNewFile({
  change,
  projectRoot,
  outputFolder,
  existingNames,
}: {
  change: GitChange;
  projectRoot: FileRef;
  outputFolder: FileRef;
  existingNames: Set<string>;
}): Promise<Step> {
  const sourcePath = projectRoot.append(`/${change.path}`);
  const content = await sourcePath.text();

  const templatePath = outputFolder.append(`/src/${change.path}`);
  await fs.create(templatePath.directory);
  await templatePath.write(content);

  const stepName = generateStepName({
    prefix: "create",
    filePath: change.path,
    existingNames,
  });

  return {
    type: "create",
    name: stepName,
    template: `src/${change.path}`,
    outputPath: change.path,
  };
}

async function processModifiedFile({
  change,
  projectRoot,
  outputFolder,
  existingNames,
  warnings,
}: {
  change: GitChange;
  projectRoot: FileRef;
  outputFolder: FileRef;
  existingNames: Set<string>;
  warnings: string[];
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
    preImage = await io.run(
      `git show HEAD:"${change.path}"`,
      { cwd: projectRoot.path },
    );
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

  const templatePath = outputFolder.append(`/src/${change.path}.modify.json`);
  await fs.create(templatePath.directory);
  await templatePath.write(JSON.stringify(result.modifications, null, 2) + "\n");

  const stepName = generateStepName({
    prefix: "modify",
    filePath: change.path,
    existingNames,
  });

  return {
    type: "modify",
    name: stepName,
    template: `src/${change.path}.modify.json`,
    outputPath: change.path,
  };
}

function processDeletedFile({
  change,
  existingNames,
}: {
  change: GitChange;
  existingNames: Set<string>;
}): Step {
  const stepName = generateStepName({
    prefix: "delete",
    filePath: change.path,
    existingNames,
  });

  return {
    type: "delete",
    name: stepName,
    outputPath: change.path,
  };
}

export async function createPowerup({
  name,
  workingDir,
  projectRoot,
  ...overrides
}: {
  name: string;
  workingDir?: string;
  projectRoot: FileRef;
} & CreatePowerupOverrides): Promise<CreatePowerupResult> {
  const root: FileRef = projectRoot;
  const mainFolder = root.append(`/${MAIN_FOLDER}`);

  if (!(await fs.exists(mainFolder))) {
    throw create_errors.main_folder_not_found();
  }

  let packageName: string;
  if (is.defined(overrides.pack) && overrides.pack.length > 0) {
    packageName = overrides.pack;
  } else {
    const packageJsonPath = root.append("/package.json");
    if (!(await fs.exists(packageJsonPath))) {
      throw create_errors.package_not_initialized();
    }
    const pkgJson = await packageJsonPath.json() as Record<string, unknown>;
    if (!is.defined(pkgJson.name) || typeof pkgJson.name !== "string" || pkgJson.name.length === 0) {
      throw create_errors.package_not_initialized();
    }
    packageName = stripScope(pkgJson.name);
  }

  if (packageName.includes("/")) {
    throw create_errors.package_not_initialized();
  }

  const powerupsType = (overrides.type ?? "single-use") as PowerUpType;
  if (powerupsType !== "multi-use" && powerupsType !== "single-use") {
    throw create_errors.missing_type();
  }

  const description = overrides.description ?? "";
  const intent = parseCommaList(overrides.intent);
  const required = parseCommaList(overrides.variables);
  const optional = parseCommaList(overrides.optionalVariables);

  let packageDependencies: Instructions["packageDependencies"] = undefined;
  if (is.defined(overrides.packageDeps) && overrides.packageDeps.length > 0) {
    try {
      packageDependencies = packageDependencyGroupArraySchema.parse(
        JSON.parse(overrides.packageDeps),
      ) as Instructions["packageDependencies"];
    } catch {
      throw create_errors.invalid_package_deps_json();
    }
  }

  const internalFolder = mainFolder.append(`/${INTERNAL_FOLDER}`);
  const packageAutoCreated = await ensurePackageExists({ packageName, internalFolder });

  const typeFolderName = powerupsFolderMap[powerupsType];
  const packageDir = internalFolder.append(`/${packageName}`);
  const typeFolder = packageDir.append(`/${typeFolderName}`);

  if (!(await fs.exists(typeFolder))) {
    await fs.create(typeFolder);
  }

  const outputFolder = typeFolder.append(`/${name}`);

  if (await fs.exists(outputFolder)) {
    throw create_errors.already_exists(name);
  }

  await fs.create(outputFolder);

  const warnings: string[] = [];
  let newFileCount = 0;
  let modifiedFileCount = 0;
  let deletedFileCount = 0;
  let steps: Step[] = [];

  if (is.defined(workingDir)) {
    const workingDirFileRef = workingDir.length === 0
      ? runtime.cwd()
      : fs.ref(path.resolve(workingDir));

    const changes = await getGitStatus({ workingDir: workingDirFileRef, projectRoot: root });

    if (changes.length === 0) {
      warnings.push(`No git changes detected in ${workingDirFileRef.path}`);
    } else {
      const existingNames = new Set<string>();

      const newFiles = changes.filter(c => c.status === "new").sort((a, b) => a.path.localeCompare(b.path));
      const modifiedFiles = changes.filter(c => c.status === "modified").sort((a, b) => a.path.localeCompare(b.path));
      const deletedFiles = changes.filter(c => c.status === "deleted").sort((a, b) => a.path.localeCompare(b.path));
      const renamedFiles = changes.filter(c => c.status === "renamed" || c.status === "unknown");

      const createSteps: Step[] = [];
      for (const change of newFiles) {
        createSteps.push(await processNewFile({ change, projectRoot: root, outputFolder, existingNames }));
      }
      newFileCount = newFiles.length;

      const modifySteps: Step[] = [];
      for (const change of modifiedFiles) {
        const step = await processModifiedFile({
          change,
          projectRoot: root,
          outputFolder,
          existingNames,
          warnings,
        });
        if (step !== null) {
          modifySteps.push(step);
        }
      }
      modifiedFileCount = modifiedFiles.length;

      const deleteSteps: Step[] = deletedFiles.map(change =>
        processDeletedFile({ change, existingNames }),
      );
      deletedFileCount = deletedFiles.length;

      for (const change of renamedFiles) {
        warnings.push(`Renamed or unknown change: ${change.path} (${change.rawStatus}) — requires manual review, not included`);
      }

      steps = [...createSteps, ...modifySteps, ...deleteSteps];
    }
  }

  const instructions = buildInstructions({
    name,
    description,
    required,
    optional,
    intent,
    packageDependencies,
    steps,
  });

  instructionsSchema.parse(instructions);

  const outputPath = outputFolder.append("/instructions.json");
  await outputPath.writeJSON(instructions as never);

  await registerPowerup({ packageDir, typeFolderName, name });
  await addPackageToConfig(root, packageName);

  return {
    packageName,
    packageAutoCreated,
    newFileCount,
    modifiedFileCount,
    deletedFileCount,
    warnings,
  };
}

export function printCreateSummary({
  name,
  type,
  result,
}: {
  name: string;
  type: string;
  result: CreatePowerupResult;
}): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  cli.print(`${green("✓")} Created powerup: ${name} (${type}) in package: ${result.packageName}${result.packageAutoCreated ? " (auto-created)" : ""}\n`);

  if (result.newFileCount > 0 || result.modifiedFileCount > 0 || result.deletedFileCount > 0) {
    cli.print(`  ${dim("files:")} ${result.newFileCount} new, ${result.modifiedFileCount} modified, ${result.deletedFileCount} deleted\n`);
  }

  if (result.warnings.length > 0) {
    cli.print(`  ${dim("warnings:")}\n`);
    for (const warning of result.warnings) {
      cli.print(`    - ${warning}\n`);
    }
  }
}