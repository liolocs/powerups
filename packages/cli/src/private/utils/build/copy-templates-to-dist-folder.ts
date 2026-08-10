import type { Step } from "@liolocs/powerups-sdk";
import type { FileRef } from "@rcompat/fs";
import is from "@rcompat/is";
import fs from "@rcompat/fs";
import build_errors from "#errors/buildErrors";
import { PACKAGE_JSON, SINGULAR_NAME_FOR_CLI } from "#constants";
import cli from "@rcompat/cli";

export default async function copyTemplatesToDistFolder({
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
  await copyOwnTemplatesToDist({
    instructionSteps,
    cwd,
    distFileRef,
  });

  await copyInternalTemplatesUsingSourceProperty({
    instructionSteps,
    distFileRef,
    source: sourceFromCompiledInstructions,
  });

  printSuccess({ distFileRef, powerupName });
}

function printSuccess({
  distFileRef,
  powerupName,
}: {
  distFileRef: FileRef;
  powerupName: string;
}) {
  const green = cli.fg.green;
  const dim = cli.fg.dim;

  cli.print(`${green("✓")} Built ${SINGULAR_NAME_FOR_CLI}: ${powerupName}\n`);
  cli.print(`  ${dim("output:")} ${distFileRef.path}\n`);
}

async function copyInternalTemplatesUsingSourceProperty({
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
    const template = (step as Step & { template?: string }).template;

    // copyInternal handles only child (internal) templates; own templates are
    // copied from cwd by copyOwnTemplatesToDist, so skip anything that isn't
    // _internal/ (and anything falsy).
    const isNotInternalTemplate = is.falsy(template)
      || !template!.startsWith("_internal/");

    if (isNotInternalTemplate) {
      continue;
    }

    if (copied.has(template!)) {
      continue;
    }

    copied.add(template!);

    const __source = (step as Step & { __source?: string }).__source ?? source;

    const pkgDir = await resolvePowerupPackageDir(__source);
    // subpath after _internal/<namespace>/
    const subpath = template!.split("/").slice(2).join("/");
    const templateSubpathFolderRef = pkgDir.append(`/dist/${subpath}`);

    if (!(await fs.exists(templateSubpathFolderRef))) {
      throw build_errors.child_not_built(template!.split("/")[1]);
    }

    const destination = distFileRef.append(`/${template}`);
    await destination.directory.create();
    await templateSubpathFolderRef.copy(destination);
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
  // sourceUrl is import.meta.url of a dist/index.js — walk up to the package root
  const path = sourceUrl.startsWith("file://") ? sourceUrl.slice(7) : sourceUrl;

  return fs.ref(path).directory;
}

async function copyOwnTemplatesToDist({
  instructionSteps,
  cwd,
  distFileRef,
}: {
  instructionSteps: Step[];
  cwd: FileRef;
  distFileRef: FileRef;
}) {
  for (const step of instructionSteps) {
    const template = (step as Step & { template?: string }).template;

    const isInvalidTemplate = templateIsFalsyOrInternal(template);

    if (isInvalidTemplate) {
      continue;
    }

    const templateFileRef = cwd.append(`/${template}`);
    const templateFileExists = await fs.exists(templateFileRef);

    if (!templateFileExists) {
      throw build_errors.template_not_found(template!);
    }

    const destination = distFileRef.append(`/${template}`);

    await destination.directory.create();

    await templateFileRef.copy(destination);
  }
}

function templateIsFalsyOrInternal(template: string | undefined): boolean {
  return is.falsy(template) || template!.startsWith("_internal/");
}