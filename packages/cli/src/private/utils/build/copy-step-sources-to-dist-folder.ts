import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import fs from "@rcompat/fs";
import build_errors from "#errors/buildErrors";
import { PACKAGE_JSON, SINGULAR_NAME_FOR_CLI } from "#constants";
import cli from "@rcompat/cli";

export default async function copyStepSourcesToDistFolder({
  powerupName,
  instructionSteps,
  cwd,
  distFileRef,
  sourceFromCompiledInstructions,
}: {
  powerupName: string;
  instructionSteps: Step[];
  cwd: FileRef;
  distFileRef: FileRef;
  sourceFromCompiledInstructions: string;
}) {
  await copyOwnSourcesToDist({ instructionSteps, cwd, distFileRef });

  await copyInternalStepSourcesUsingSourceProperty({
    instructionSteps,
    distFileRef,
    source: sourceFromCompiledInstructions,
  });

  printSuccess({ distFileRef, powerupName });
}

function printSuccess({ distFileRef, powerupName }: { distFileRef: FileRef; powerupName: string }): void {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  cli.print(`${green("✓")} Built ${SINGULAR_NAME_FOR_CLI}: ${powerupName}\n`);
  cli.print(`  ${dim("output:")} ${distFileRef.path}\n`);
}

function sourcePathsOfStep(step: Step): string[] {
  const paths: string[] = [];
  const file = (step as Step & { file?: string }).file;
  const template = (step as Step & { template?: string }).template;

  if (is.truthy(file) && !file!.startsWith("_internal/")) {
    paths.push(file!);
  }

  if (is.truthy(template) && !template!.startsWith("_internal/")) {
    paths.push(template!);
  }

  return paths;
}

async function copyOwnSourcesToDist({
  instructionSteps,
  cwd,
  distFileRef,
}: {
  instructionSteps: Step[];
  cwd: FileRef;
  distFileRef: FileRef;
}) {
  for (const step of instructionSteps) {
    for (const sourcePath of sourcePathsOfStep(step)) {
      const sourceFileRef = cwd.append(`/${sourcePath}`);

      if (!(await fs.exists(sourceFileRef))) {
        throw build_errors.source_not_found(sourcePath);
      }

      const destination = distFileRef.append(`/${sourcePath}`);
      await destination.directory.create();
      await sourceFileRef.copy(destination);
    }
  }
}

async function copyInternalStepSourcesUsingSourceProperty({
  instructionSteps,
  distFileRef,
  source,
}: {
  instructionSteps: Step[];
  distFileRef: FileRef;
  source: string;
}) {
  const copied = new Set<string>();

  for (const step of instructionSteps) {
    const internalPaths: string[] = [];
    const file = (step as Step & { file?: string }).file;
    const template = (step as Step & { template?: string }).template;

    if (is.truthy(file) && file!.startsWith("_internal/")) {
      internalPaths.push(file!);
    }

    if (is.truthy(template) && template!.startsWith("_internal/")) {
      internalPaths.push(template!);
    }

    for (const internalPath of internalPaths) {
      if (copied.has(internalPath)) {
        continue;
      }

      copied.add(internalPath);

      const __source = (step as Step & { __source?: string }).__source ?? source;
      const pkgDir = await resolvePowerupPackageDir(__source);
      const subpath = internalPath.split("/").slice(2).join("/");
      const sourceSubpathRef = pkgDir.append(`/dist/${subpath}`);

      if (!(await fs.exists(sourceSubpathRef))) {
        throw build_errors.child_not_built(internalPath.split("/")[1]!);
      }

      const destination = distFileRef.append(`/${internalPath}`);
      await destination.directory.create();
      await sourceSubpathRef.copy(destination);
    }
  }
}

async function resolvePowerupPackageDir(sourceUrl: string): Promise<FileRef> {
  let powerupPackageDir = fileUrlToDir(sourceUrl);

  for (let i = 0; i < 20; i++) {
    if (await fs.exists(powerupPackageDir.append(`/${PACKAGE_JSON}`))) {
      return powerupPackageDir;
    }

    powerupPackageDir = powerupPackageDir.up(1);
  }

  throw new Error(`Could not resolve package directory from ${sourceUrl}`);
}

function fileUrlToDir(sourceUrl: string): FileRef {
  const path = sourceUrl.startsWith("file://") ? sourceUrl.slice(7) : sourceUrl;

  return fs.ref(path).directory;
}